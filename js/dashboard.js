import { getSupabase, initAuthListener, signOut } from './auth-service.js';
import { initUploadService, uploadFile } from './upload-service.js';

const app = {
    supabase: null,
    user: null,
    restaurant: null,
    items: [],
    activeCategory: null,
};

let authBootstrappedForUser = null;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function qs(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (char) => ESC[char]);
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function setSaveStatus(text, reset = false) {
    const status = qs('saveStatus');
    if (!status) return;
    status.textContent = text;
    if (reset) {
        window.setTimeout(() => {
            status.textContent = 'Alterações guardadas automaticamente';
        }, 1400);
    }
}

function getCategories() {
    const categories = new Set(app.items.map((item) => item.category).filter(Boolean));
    (app.restaurant?.category_order || []).forEach((category) => categories.add(category));
    const result = Array.from(categories);
    const order = app.restaurant?.category_order || [];

    result.sort((a, b) => {
        const indexA = order.indexOf(a);
        const indexB = order.indexOf(b);
        return (indexA === -1 ? 9999 : indexA) - (indexB === -1 ? 9999 : indexB);
    });

    return result;
}

function itemsForCategory(category) {
    return app.items
        .filter((item) => item.category === category)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt'));
}

function applyRestaurantTheme() {
    const editor = qs('mobile-view');
    const restaurant = app.restaurant;
    if (!editor || !restaurant) return;

    const font = restaurant.font || 'Outfit';
    let fontLink = qs('restaurantFontLink');
    if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = 'restaurantFontLink';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }
    fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700&display=swap`;

    editor.style.fontFamily = `'${font}', sans-serif`;
    editor.style.setProperty('--font-heading', `'${font}', sans-serif`);
    if (restaurant.color_primary) editor.style.setProperty('--primary', restaurant.color_primary);
    if (restaurant.color_text) editor.style.setProperty('--text', restaurant.color_text);
    if (restaurant.color_background) {
        editor.style.setProperty('--bg-mobile', restaurant.color_background);
        const isDark = ['#1a1a1a', '#121212', '#000000'].includes(
            restaurant.color_background.toLowerCase());
        editor.style.setProperty('--bg-card', isDark ? '#252525' : '#ffffff');
        editor.style.setProperty('--bg-badge', isDark ? '#333333' : '#ebebeb');
        editor.style.setProperty('--border', isDark ? '#333333' : '#f0f0f0');
        editor.style.setProperty('--text-muted', isDark ? '#a0a0a0' : '#666666');
    }
}

function renderInfoBadges() {
    const container = qs('infoBadges');
    const restaurant = app.restaurant;
    if (!container || !restaurant) return;

    const badges = [];
    if (restaurant.wifi_ssid || restaurant.wifi_password) {
        badges.push(`
            <span class="info-badge" data-badge="wifi">
                <i class="fa-solid fa-wifi"></i>
                <span>${escapeHTML(restaurant.wifi_ssid || 'Wi-Fi')}</span>
            </span>`);
    }
    if (restaurant.phone) {
        badges.push(`
            <span class="info-badge" data-badge="phone">
                <i class="fa-solid fa-phone"></i>
                <span>${escapeHTML(restaurant.phone)}</span>
            </span>`);
    }
    if (restaurant.address) {
        badges.push(`
            <span class="info-badge" data-badge="address">
                <i class="fa-solid fa-location-dot"></i>
                <span>${escapeHTML(restaurant.address)}</span>
            </span>`);
    }

    badges.push(`
        <button class="badge-editor-action" type="button" data-badge="add"
            aria-label="Editar informações" title="Editar informações">
            <i class="fa-solid fa-plus"></i>
        </button>`);

    container.innerHTML = badges.join('');
}

function renderCover() {
    const cover = qs('coverEditor');
    const placeholder = qs('coverPlaceholder');
    const removeButton = qs('removeCoverBtn');
    const addButton = qs('addCoverBtn');
    const hero = qs('heroHeader');
    if (!cover || !app.restaurant) return;

    if (app.restaurant.cover_url) {
        cover.style.display = 'block';
        cover.style.backgroundImage = `url('${app.restaurant.cover_url}')`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
        if (hero) hero.style.paddingTop = '';
        if (placeholder) placeholder.hidden = true;
        if (removeButton) removeButton.hidden = false;
        if (addButton) addButton.hidden = true;
    } else {
        cover.style.backgroundImage = '';
        cover.style.display = 'none';
        if (hero) hero.style.paddingTop = '100px';
        if (placeholder) placeholder.hidden = false;
        if (removeButton) removeButton.hidden = true;
        if (addButton) addButton.hidden = false;
    }
}

function renderCategoryTabs(categories) {
    const tabs = qs('categoryTabs');
    if (!tabs) return;

    tabs.innerHTML = categories.map((category) => `
        <button class="tab-btn ${category === app.activeCategory ? 'active' : ''}" type="button"
            data-action="select-category" data-category="${escapeHTML(category)}">
            ${escapeHTML(category)}
        </button>
    `).join('') + `
        <button class="tab-btn tab-add" type="button" data-action="add-category"
            aria-label="Adicionar categoria" title="Adicionar categoria">
            <i class="fa-solid fa-plus"></i>
        </button>
    `;
}

function renderItem(item) {
    const image = item.image_url
        ? `<div class="item-img"><img src="${escapeHTML(item.image_url)}" loading="lazy" alt="${escapeHTML(item.name)}"></div>`
        : '';

    return `
        <article class="menu-item ${item.available ? '' : 'unavailable'}">
            <div class="item-text">
                <h3>${escapeHTML(item.name)}</h3>
                <p class="item-desc">${escapeHTML(item.description || '')}</p>
                <div class="item-price">${Number(item.price || 0).toFixed(2)}€</div>
            </div>
            ${image}
            <div class="item-actions context-tools">
                <button class="item-icon context-toggle" type="button" data-action="toggle-tools"
                    aria-label="Ações do prato" title="Ações do prato">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
                <div class="context-actions">
                    <button class="item-icon" type="button" data-action="edit-item" data-item-id="${item.id}"
                        aria-label="Editar prato" title="Editar prato">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="item-icon" type="button" data-action="item-image" data-item-id="${item.id}"
                        aria-label="${item.image_url ? 'Alterar imagem' : 'Adicionar imagem'}"
                        title="${item.image_url ? 'Alterar imagem' : 'Adicionar imagem'}">
                        <i class="fa-regular fa-image"></i>
                    </button>
                    <button class="item-icon" type="button" data-action="toggle-item" data-item-id="${item.id}"
                        aria-label="${item.available ? 'Ocultar prato' : 'Mostrar prato'}"
                        title="${item.available ? 'Ocultar prato' : 'Mostrar prato'}">
                        <i class="fa-solid ${item.available ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                    <button class="item-icon item-icon-danger" type="button" data-action="delete-item"
                        data-item-id="${item.id}" aria-label="Apagar prato" title="Apagar prato">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

function renderActiveCategory(categories) {
    const editor = qs('categoryEditor');
    if (!editor) return;

    if (!categories.length || !app.activeCategory) {
        editor.innerHTML = `
            <div class="empty-menu">
                <p>O menu ainda não tem categorias.</p>
                <button type="button" data-action="add-category" aria-label="Adicionar categoria">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;
        return;
    }

    const category = app.activeCategory;
    const items = itemsForCategory(category);
    const categoryImage = app.restaurant.category_images?.[category];
    const categoryIndex = categories.indexOf(category);
    const encodedCategory = encodeURIComponent(category);

    editor.innerHTML = `
        <div class="slide-content">
            ${categoryImage ? `
                <div class="slide-hero">
                    <img src="${escapeHTML(categoryImage)}" loading="lazy" alt="${escapeHTML(category)}">
                </div>` : ''}
            <div class="slide-header">
                <h2 class="slide-title" contenteditable="true" spellcheck="false"
                    data-original-category="${encodedCategory}">${escapeHTML(category)}</h2>
                <div class="slide-actions">
                    <button class="category-icon" type="button" data-action="category-image"
                        data-category="${encodedCategory}" aria-label="${categoryImage ? 'Alterar imagem' : 'Adicionar imagem'}"
                        title="${categoryImage ? 'Alterar imagem' : 'Adicionar imagem'}">
                        <i class="fa-regular fa-image"></i>
                    </button>
                    <button class="category-icon" type="button" data-action="move-category"
                        data-direction="-1" aria-label="Mover categoria para a esquerda"
                        title="Mover para a esquerda" ${categoryIndex === 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <button class="category-icon" type="button" data-action="move-category"
                        data-direction="1" aria-label="Mover categoria para a direita"
                        title="Mover para a direita" ${categoryIndex === categories.length - 1 ? 'disabled' : ''}>
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    ${categoryImage ? `
                        <button class="category-icon category-icon-danger" type="button"
                            data-action="remove-category-image" data-category="${encodedCategory}"
                            aria-label="Apagar imagem da categoria" title="Apagar imagem da categoria">
                            <i class="fa-solid fa-image-slash"></i>
                        </button>` : ''}
                    <button class="category-icon category-icon-danger" type="button"
                        data-action="delete-category" data-category="${encodedCategory}"
                        aria-label="Apagar categoria" title="Apagar categoria">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="items-grid">
                ${items.map(renderItem).join('')}
            </div>
            <button class="item-add" type="button" data-action="add-item" data-category="${encodedCategory}"
                aria-label="Adicionar prato" title="Adicionar prato">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;
}

function renderDashboard() {
    if (!app.restaurant) return;

    const categories = getCategories();
    if (!categories.includes(app.activeCategory)) {
        app.activeCategory = categories[0] || null;
    }

    qs('authLoading').hidden = true;
    qs('authError').hidden = true;
    qs('emptyState').hidden = true;
    qs('dashboardShell').hidden = false;

    applyRestaurantTheme();
    renderCover();
    renderInfoBadges();

    qs('restName').textContent = app.restaurant.name || '';
    qs('restDesc').textContent = app.restaurant.description || '';
    qs('openLiveBtn').href = `menu.html?id=${encodeURIComponent(app.restaurant.slug)}`;

    renderCategoryTabs(categories);
    renderActiveCategory(categories);
}

function renderEmptyState() {
    qs('authLoading').hidden = true;
    qs('dashboardShell').hidden = true;
    qs('emptyState').hidden = false;
}

async function loadDashboardData() {
    if (!app.supabase || !app.user) return;

    const { data: restaurant, error: restaurantError } = await app.supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', app.user.id)
        .maybeSingle();

    if (restaurantError) {
        console.error('Erro ao carregar restaurante:', restaurantError.message);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
        qs('dashboardShell').hidden = true;
        return;
    }

    if (!restaurant) {
        renderEmptyState();
        return;
    }

    const { data: items, error: itemsError } = await app.supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('category')
        .order('name');

    if (itemsError) console.error('Erro ao carregar pratos:', itemsError.message);

    app.restaurant = restaurant;
    app.items = items || [];
    renderDashboard();
}

async function saveRestaurantField(field, value) {
    const normalized = value.trim();
    if (normalized === String(app.restaurant[field] || '')) return;

    setSaveStatus('A guardar...');
    const { error } = await app.supabase
        .from('restaurants')
        .update({ [field]: normalized })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    app.restaurant[field] = normalized;
    setSaveStatus('Guardado', true);
}

async function addCategory() {
    const categories = getCategories();
    let name = 'Nova categoria';
    let counter = 2;
    while (categories.includes(name)) name = `Nova categoria ${counter++}`;

    const order = [...categories, name];
    setSaveStatus('A criar categoria...');

    const { error } = await app.supabase
        .from('restaurants')
        .update({ category_order: order })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível criar');
        return;
    }

    app.restaurant.category_order = order;
    app.activeCategory = name;
    renderDashboard();
    window.requestAnimationFrame(() => {
        const title = document.querySelector('#categoryEditor .slide-title');
        if (!title) return;
        title.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(title);
        selection.removeAllRanges();
        selection.addRange(range);
    });
    setSaveStatus('Categoria criada', true);
}

async function renameCategory(oldName, rawName) {
    const newName = rawName.trim();
    if (!newName || newName === oldName) {
        renderDashboard();
        return;
    }

    setSaveStatus('A guardar categoria...');
    const { error } = await app.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('restaurant_id', app.restaurant.id)
        .eq('category', oldName);

    if (error) {
        console.error(error);
        renderDashboard();
        return;
    }

    const updates = {};
    if (app.restaurant.category_order?.includes(oldName)) {
        updates.category_order = app.restaurant.category_order.map((category) =>
            category === oldName ? newName : category);
    }
    if (app.restaurant.category_images?.[oldName]) {
        const images = { ...app.restaurant.category_images };
        images[newName] = images[oldName];
        delete images[oldName];
        updates.category_images = images;
    }
    if (Object.keys(updates).length) {
        await app.supabase.from('restaurants').update(updates).eq('id', app.restaurant.id);
    }

    app.activeCategory = newName;
    await loadDashboardData();
    setSaveStatus('Categoria guardada', true);
}

async function moveCategory(direction) {
    const categories = getCategories();
    const index = categories.indexOf(app.activeCategory);
    const target = index + Number(direction);
    if (index < 0 || target < 0 || target >= categories.length) return;

    [categories[index], categories[target]] = [categories[target], categories[index]];
    const { error } = await app.supabase
        .from('restaurants')
        .update({ category_order: categories })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        return;
    }

    app.restaurant.category_order = categories;
    renderDashboard();
    setSaveStatus('Ordem guardada', true);
}

async function deleteCategory(category) {
    if (!window.confirm(`Apagar a categoria "${category}" e todos os pratos nela?`)) return;

    await app.supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', app.restaurant.id)
        .eq('category', category);

    const images = { ...(app.restaurant.category_images || {}) };
    delete images[category];
    const order = (app.restaurant.category_order || []).filter((entry) => entry !== category);
    await app.supabase
        .from('restaurants')
        .update({ category_images: images, category_order: order })
        .eq('id', app.restaurant.id);

    app.activeCategory = null;
    await loadDashboardData();
    setSaveStatus('Categoria apagada', true);
}

function pickImage(onSelected) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
        if (input.files?.[0]) onSelected(input.files[0]);
    }, { once: true });
    input.click();
}

async function uploadCategoryImage(category) {
    pickImage(async (file) => {
        setSaveStatus('A carregar imagem...');
        const { data, error } = await uploadFile(file, `cat-${slugify(category)}`);
        if (error || !data) {
            console.error(error);
            setSaveStatus('Não foi possível carregar');
            return;
        }

        const images = { ...(app.restaurant.category_images || {}), [category]: data.publicUrl };
        await app.supabase.from('restaurants').update({ category_images: images }).eq('id', app.restaurant.id);
        await loadDashboardData();
        setSaveStatus('Imagem guardada', true);
    });
}

async function editInfoBadge(type) {
    let updates = {};

    if (type === 'wifi') {
        const ssid = window.prompt('Nome da rede Wi-Fi', app.restaurant.wifi_ssid || '');
        if (ssid === null) return;
        const password = window.prompt('Password da rede Wi-Fi', app.restaurant.wifi_password || '');
        if (password === null) return;
        updates = { wifi_ssid: ssid.trim(), wifi_password: password.trim() };
    } else if (type === 'phone') {
        const phone = window.prompt('Telefone', app.restaurant.phone || '');
        if (phone === null) return;
        updates = { phone: phone.trim() };
    } else if (type === 'address') {
        const address = window.prompt('Morada', app.restaurant.address || '');
        if (address === null) return;
        updates = { address: address.trim() };
    } else {
        const choice = window.prompt('O que queres editar? Escreve: wifi, telefone ou morada', 'wifi');
        if (!choice) return;
        const normalized = choice.trim().toLowerCase();
        if (normalized === 'wifi') return editInfoBadge('wifi');
        if (normalized === 'telefone') return editInfoBadge('phone');
        if (normalized === 'morada') return editInfoBadge('address');
        return;
    }

    setSaveStatus('A guardar informações...');
    const { error } = await app.supabase
        .from('restaurants')
        .update(updates)
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    Object.assign(app.restaurant, updates);
    renderInfoBadges();
    setSaveStatus('Informações guardadas', true);
}

async function removeCategoryImage(category) {
    const images = { ...(app.restaurant.category_images || {}) };
    delete images[category];
    await app.supabase.from('restaurants').update({ category_images: images }).eq('id', app.restaurant.id);
    await loadDashboardData();
    setSaveStatus('Imagem removida', true);
}

function populateCategorySelect(selectedCategory) {
    const select = qs('itemCategoryInput');
    select.innerHTML = getCategories().map((category) =>
        `<option value="${escapeHTML(category)}" ${category === selectedCategory ? 'selected' : ''}>
            ${escapeHTML(category)}
        </option>`
    ).join('');
}

function openItemModal(item = null, category = app.activeCategory) {
    qs('itemModalTitle').textContent = item ? 'Editar prato' : 'Adicionar prato';
    qs('itemIdInput').value = item?.id || '';
    qs('itemNameInput').value = item?.name || '';
    qs('itemPriceInput').value = item ? Number(item.price || 0).toFixed(2) : '';
    qs('itemDescInput').value = item?.description || '';
    populateCategorySelect(item?.category || category);
    qs('itemModal').hidden = false;
    window.setTimeout(() => qs('itemNameInput').focus(), 40);
}

function closeItemModal() {
    qs('itemModal').hidden = true;
}

async function saveItem(event) {
    event.preventDefault();
    const id = qs('itemIdInput').value;
    const price = Number.parseFloat(qs('itemPriceInput').value.replace(',', '.'));
    const payload = {
        name: qs('itemNameInput').value.trim(),
        description: qs('itemDescInput').value.trim(),
        category: qs('itemCategoryInput').value,
        price: Number.isNaN(price) ? 0 : price,
    };

    if (!payload.name) return;
    setSaveStatus('A guardar prato...');

    let error;
    if (id) {
        ({ error } = await app.supabase.from('menu_items').update(payload).eq('id', id));
    } else {
        ({ error } = await app.supabase.from('menu_items').insert([{
            ...payload,
            restaurant_id: app.restaurant.id,
            available: true,
        }]));
    }

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    app.activeCategory = payload.category;
    closeItemModal();
    await loadDashboardData();
    setSaveStatus('Prato guardado', true);
}

async function toggleItem(id) {
    const item = app.items.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    const available = !item.available;
    const { error } = await app.supabase.from('menu_items').update({ available }).eq('id', id);
    if (error) {
        console.error(error);
        return;
    }

    item.available = available;
    renderDashboard();
    setSaveStatus(available ? 'Prato visível' : 'Prato oculto', true);
}

async function deleteItem(id) {
    if (!window.confirm('Apagar este prato?')) return;
    await app.supabase.from('menu_items').delete().eq('id', id);
    await loadDashboardData();
    setSaveStatus('Prato apagado', true);
}

async function uploadItemImage(id) {
    pickImage(async (file) => {
        setSaveStatus('A carregar imagem...');
        const { data, error } = await uploadFile(file, `item-${id}`);
        if (error || !data) {
            console.error(error);
            setSaveStatus('Não foi possível carregar');
            return;
        }

        await app.supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', id);
        await loadDashboardData();
        setSaveStatus('Imagem guardada', true);
    });
}

async function uploadCover(input) {
    if (!input.files?.[0]) return;
    setSaveStatus('A carregar capa...');
    const { data, error } = await uploadFile(input.files[0], 'cover');
    input.value = '';

    if (error || !data) {
        console.error(error);
        setSaveStatus('Não foi possível carregar');
        return;
    }

    await app.supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', app.restaurant.id);
    await loadDashboardData();
    setSaveStatus('Capa guardada', true);
}

async function removeCover() {
    if (!app.restaurant.cover_url || !window.confirm('Remover a capa do menu?')) return;
    await app.supabase.from('restaurants').update({ cover_url: null }).eq('id', app.restaurant.id);
    await loadDashboardData();
    setSaveStatus('Capa removida', true);
}

function handleEditorClick(event) {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const category = actionElement.dataset.category
        ? decodeURIComponent(actionElement.dataset.category)
        : app.activeCategory;
    const itemId = actionElement.dataset.itemId;

    if (action === 'toggle-tools') {
        const tools = actionElement.closest('.context-tools');
        document.querySelectorAll('.context-tools.is-open').forEach((entry) => {
            if (entry !== tools) entry.classList.remove('is-open');
        });
        tools?.classList.toggle('is-open');
    } else if (action === 'select-category') {
        app.activeCategory = actionElement.dataset.category;
        renderDashboard();
    } else if (action === 'add-category') {
        addCategory();
    } else if (action === 'move-category') {
        moveCategory(actionElement.dataset.direction);
    } else if (action === 'delete-category') {
        deleteCategory(category);
    } else if (action === 'category-image') {
        uploadCategoryImage(category);
    } else if (action === 'remove-category-image') {
        removeCategoryImage(category);
    } else if (action === 'add-item') {
        openItemModal(null, category);
    } else if (action === 'edit-item') {
        openItemModal(app.items.find((item) => String(item.id) === String(itemId)));
    } else if (action === 'toggle-item') {
        toggleItem(itemId);
    } else if (action === 'delete-item') {
        deleteItem(itemId);
    } else if (action === 'item-image') {
        uploadItemImage(itemId);
    }
}

function bindEvents() {
    qs('restName').addEventListener('blur', (event) => saveRestaurantField('name', event.target.innerText));
    qs('restDesc').addEventListener('blur', (event) =>
        saveRestaurantField('description', event.target.innerText));

    [qs('restName'), qs('restDesc')].forEach((element) => {
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                element.blur();
            }
        });
    });

    qs('categoryTabs').addEventListener('click', handleEditorClick);
    qs('categoryEditor').addEventListener('click', handleEditorClick);
    qs('infoBadges').addEventListener('click', (event) => {
        const badge = event.target.closest('[data-badge]');
        if (badge) editInfoBadge(badge.dataset.badge);
    });
    qs('categoryEditor').addEventListener('focusout', (event) => {
        const title = event.target.closest('.slide-title');
        if (!title) return;
        renameCategory(decodeURIComponent(title.dataset.originalCategory), title.innerText);
    });
    qs('categoryEditor').addEventListener('keydown', (event) => {
        if (event.target.matches('.slide-title') && event.key === 'Enter') {
            event.preventDefault();
            event.target.blur();
        }
    });

    qs('editCoverBtn').addEventListener('click', () => qs('coverInput').click());
    qs('addCoverBtn').addEventListener('click', () => qs('coverInput').click());
    qs('coverPlaceholder').addEventListener('click', () => qs('coverInput').click());
    qs('coverInput').addEventListener('change', (event) => uploadCover(event.target));
    qs('removeCoverBtn').addEventListener('click', removeCover);
    qs('refreshMenuBtn').addEventListener('click', loadDashboardData);
    qs('itemForm').addEventListener('submit', saveItem);
    document.querySelectorAll('[data-close-modal]').forEach((button) =>
        button.addEventListener('click', closeItemModal));
    qs('itemModal').addEventListener('click', (event) => {
        if (event.target === qs('itemModal')) closeItemModal();
    });
}

async function init() {
    try {
        bindEvents();
        const supabase = await getSupabase();
        if (!supabase) {
            qs('authLoading').hidden = true;
            qs('authError').hidden = false;
            return;
        }

        app.supabase = supabase;
        initUploadService(supabase);

        initAuthListener(async (user) => {
            if (authBootstrappedForUser === user.id) return;
            authBootstrappedForUser = user.id;
            app.user = user;
            await loadDashboardData();
        }, () => {
            window.location.href = 'login.html';
        });
    } catch (error) {
        console.error('Dashboard init error:', error);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
    }
}

window.signOut = () => signOut();
init();
