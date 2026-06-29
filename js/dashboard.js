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
const ITEM_PLACEHOLDER_IMAGE = 'assets/images/item-placeholder.svg';
const COVER_PLACEHOLDER_IMAGE = 'assets/images/cover-placeholder.svg';
const QR_ICON_SIZE = 260;
const FONT_OPTIONS = [
    'Outfit',
    'Inter',
    'Poppins',
    'Montserrat',
    'Lora',
    'Playfair Display',
    'Merriweather',
    'Roboto Slab',
    'Oswald',
    'Dancing Script',
];
const APPEARANCE_FIELDS = ['color_background', 'color_text', 'color_primary'];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
let qrCode = null;

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

function normalizeHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function getLiveMenuUrl() {
    const slug = app.restaurant?.slug || '';
    return `${window.location.origin}/menu.html?id=${encodeURIComponent(slug)}`;
}

function getGoogleFontHref(fonts) {
    const families = fonts
        .map((font) => `family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700`)
        .join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function loadFontOptions() {
    let fontLink = qs('dashboardFontOptionsLink');
    if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = 'dashboardFontOptionsLink';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }
    fontLink.href = getGoogleFontHref(FONT_OPTIONS);
}

function setSaveStatus(text, reset = false) {
    const status = qs('saveStatus');
    if (!status) return;
    status.textContent = text;
    if (reset) {
        window.setTimeout(() => {
            status.textContent = 'AlteraÃ§Ãµes guardadas automaticamente';
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
    editor.style.setProperty('--font', `'${font}', sans-serif`);
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
        editor.style.setProperty('--item-divider', isDark ? '#3a3a3c' : '#d2d2d7');
        editor.style.setProperty('--text-muted', isDark ? '#a0a0a0' : '#666666');
    }
}

function openAppearanceModal() {
    if (!app.restaurant) return;
    const errorEl = qs('appearanceError');
    if (errorEl) errorEl.hidden = true;
    qs('colorBackgroundInput').value = normalizeHex(app.restaurant.color_background, '#ffffff');
    qs('colorTextInput').value = normalizeHex(app.restaurant.color_text, '#1d1d1f');
    qs('colorPrimaryInput').value = normalizeHex(app.restaurant.color_primary, '#0a84ff');
    qs('appearanceModal').hidden = false;
}

function closeAppearanceModal() {
    qs('appearanceModal').hidden = true;
}

async function saveAppearanceModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const availableFields = APPEARANCE_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(app.restaurant, field));
    if (availableFields.length !== APPEARANCE_FIELDS.length) {
        const errorEl = qs('appearanceError');
        if (errorEl) {
            errorEl.textContent = 'As colunas de cores ainda nao existem no Supabase.';
            errorEl.hidden = false;
        }
        return;
    }

    const updates = {
        color_background: qs('colorBackgroundInput').value,
        color_text: qs('colorTextInput').value,
        color_primary: qs('colorPrimaryInput').value,
    };
    const changed = Object.entries(updates).some(([key, value]) =>
        String(value || '') !== String(app.restaurant[key] || ''));

    if (!changed) {
        closeAppearanceModal();
        return;
    }

    setSaveStatus('A guardar cores...');
    const { error } = await app.supabase
        .from('restaurants')
        .update(updates)
        .eq('id', app.restaurant.id);

    if (error) {
        const errorEl = qs('appearanceError');
        if (errorEl) {
            errorEl.textContent = error.message || 'Nao foi possivel guardar as cores.';
            errorEl.hidden = false;
        }
        return;
    }

    Object.assign(app.restaurant, updates);
    renderDashboard();
    closeAppearanceModal();
    setSaveStatus('Cores guardadas', true);
}

function renderFontOptions() {
    const select = qs('fontSelect');
    if (!select) return;
    const currentFont = app.restaurant?.font || 'Outfit';
    const options = FONT_OPTIONS.includes(currentFont) ? FONT_OPTIONS : [currentFont, ...FONT_OPTIONS];
    select.innerHTML = options.map((font) => `
        <option value="${escapeHTML(font)}" style="font-family:'${escapeHTML(font)}', sans-serif">
            ${escapeHTML(font)}
        </option>
    `).join('');
    select.value = currentFont;
    updateFontPreview();
}

function updateFontPreview() {
    const font = qs('fontSelect')?.value || 'Outfit';
    const preview = qs('fontPreview');
    if (preview) preview.style.fontFamily = `'${font}', sans-serif`;
    const select = qs('fontSelect');
    if (select) select.style.fontFamily = `'${font}', sans-serif`;
}

function openFontModal() {
    if (!app.restaurant) return;
    loadFontOptions();
    renderFontOptions();
    qs('fontModal').hidden = false;
}

function closeFontModal() {
    qs('fontModal').hidden = true;
}

async function saveFontModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const font = qs('fontSelect').value || 'Outfit';
    if (font === (app.restaurant.font || 'Outfit')) {
        closeFontModal();
        return;
    }

    setSaveStatus('A guardar fonte...');
    const { error } = await app.supabase
        .from('restaurants')
        .update({ font })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('Nao foi possivel guardar');
        return;
    }

    app.restaurant.font = font;
    renderDashboard();
    closeFontModal();
    setSaveStatus('Fonte guardada', true);
}

function openQrModal() {
    if (!app.restaurant) return;
    qs('qrModal').hidden = false;
    renderQrCode();
}

function closeQrModal() {
    qs('qrModal').hidden = true;
}

function getQrOptions() {
    return {
        width: QR_ICON_SIZE,
        height: QR_ICON_SIZE,
        type: 'canvas',
        data: getLiveMenuUrl(),
        margin: 0,
        qrOptions: {
            errorCorrectionLevel: 'H',
        },
        dotsOptions: {
            color: '#111111',
            type: 'rounded',
        },
        cornersSquareOptions: {
            color: '#111111',
            type: 'extra-rounded',
        },
        cornersDotOptions: {
            color: '#111111',
        },
        backgroundOptions: {
            color: 'rgba(255,255,255,0)',
        },
    };
}

function renderQrCode() {
    const box = qs('qrCodeBox');
    if (!box) return;
    box.innerHTML = '';

    if (typeof window.QRCodeStyling === 'undefined') {
        box.textContent = 'QR indisponivel';
        return;
    }

    qrCode = new window.QRCodeStyling(getQrOptions());
    qrCode.append(box);
}

function getQrFileName() {
    return `menu-${slugify(app.restaurant?.slug || app.restaurant?.name || 'qrcode')}-qr`;
}

function downloadQrPng() {
    if (!qrCode) renderQrCode();
    qrCode?.download({ name: getQrFileName(), extension: 'png' });
}

async function downloadQrPdf() {
    if (!qrCode) renderQrCode();
    if (!qrCode || !window.jspdf?.jsPDF) return;
    const blob = await qrCode.getRawData('png');
    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
    const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [90, 90],
    });
    pdf.addImage(dataUrl, 'PNG', 12, 12, 66, 66);
    pdf.save(`${getQrFileName()}.pdf`);
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

    container.innerHTML = badges.join('');
}

function renderCover() {
    const cover = qs('coverEditor');
    const placeholder = qs('coverPlaceholder');
    const removeButton = qs('removeCoverBtn');
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
    } else {
        cover.style.backgroundImage = '';
        cover.style.display = 'none';
        if (hero) hero.style.paddingTop = '100px';
        if (placeholder) placeholder.hidden = false;
        if (removeButton) removeButton.hidden = true;
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
        <button class="item-edit-btn" type="button" data-action="open-categories-modal"
            aria-label="Editar categorias" title="Editar categorias">
            <i class="fa-solid fa-pencil"></i>
        </button>
    `;
}

function renderItem(item) {
    const image = item.image_url
        ? `<div class="item-img"><img src="${escapeHTML(item.image_url)}" loading="lazy" alt="${escapeHTML(item.name)}"></div>`
        : `<div class="item-img item-img-placeholder">
                <img src="${ITEM_PLACEHOLDER_IMAGE}" loading="lazy" alt="Imagem de exemplo">
           </div>`;

    return `
        <article class="menu-item ${item.available ? '' : 'unavailable'}" data-item-id="${item.id}">
            <button class="item-edit-btn" type="button" data-action="edit-item" data-item-id="${item.id}"
                aria-label="Editar prato" title="Editar prato">
                <i class="fa-solid fa-pencil"></i>
            </button>
            <div class="item-text">
                <h3>${escapeHTML(item.name)}</h3>
                <p class="item-desc">${escapeHTML(item.description || '')}</p>
                <div class="item-price">${Number(item.price || 0).toFixed(2)}€</div>
            </div>
            ${image}
        </article>
    `;
}

function readRestaurantForm() {
    return {
        name: qs('heroNameInput').value.trim(),
        description: qs('heroDescInput').value.trim(),
        wifi_ssid: qs('heroWifiInput').value.trim(),
        wifi_password: qs('heroWifiPasswordInput').value.trim(),
        phone: qs('heroPhoneInput').value.trim(),
    };
}

function renderCategoriesModal() {
    const list = qs('categoriesList');
    if (!list) return;

    const categories = getCategories();
    list.innerHTML = categories.map((category, index) => `
        <div class="category-row" data-original-category="${escapeHTML(category)}">
            <input class="category-row-input" type="text" value="${escapeHTML(category)}" spellcheck="false">
            <div class="category-row-actions">
                <button class="row-icon-btn" type="button" data-action="category-row-move"
                    data-direction="-1" aria-label="Mover para cima" title="Mover para cima"
                    ${index === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="row-icon-btn" type="button" data-action="category-row-move"
                    data-direction="1" aria-label="Mover para baixo" title="Mover para baixo"
                    ${index === categories.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button class="row-icon-btn row-icon-btn-danger" type="button"
                    data-action="category-row-delete" aria-label="Apagar categoria" title="Apagar categoria">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    updateCategoryModalControls();
}

function openHeroModal() {
    if (!app.restaurant) return;
    qs('heroNameInput').value = app.restaurant.name || '';
    qs('heroDescInput').value = app.restaurant.description || '';
    qs('heroWifiInput').value = app.restaurant.wifi_ssid || '';
    qs('heroWifiPasswordInput').value = app.restaurant.wifi_password || '';
    qs('heroPhoneInput').value = app.restaurant.phone || '';
    setHeroModalCoverPreview();
    qs('heroModal').hidden = false;
    window.setTimeout(() => qs('heroNameInput').focus(), 40);
}

function closeHeroModal() {
    qs('heroModal').hidden = true;
}

function setHeroModalCoverPreview() {
    const preview = qs('heroCoverPreviewImage');
    const previewContainer = qs('heroCoverPreview');
    const actionBtn = qs('heroCoverActionBtn');
    if (!preview) return;

    const coverUrl = app.restaurant?.cover_url || COVER_PLACEHOLDER_IMAGE;
    preview.src = coverUrl;
    preview.alt = app.restaurant?.cover_url ? 'Capa atual do restaurante' : 'Sem capa definida';
    if (previewContainer) previewContainer.dataset.hasCover = app.restaurant?.cover_url ? 'true' : 'false';
    if (actionBtn) {
        actionBtn.innerHTML = app.restaurant?.cover_url
            ? '<i class="fa-solid fa-trash"></i>'
            : '<i class="fa-solid fa-pencil"></i>';
        actionBtn.setAttribute('aria-label', app.restaurant?.cover_url ? 'Remover capa' : 'Alterar capa');
        actionBtn.title = app.restaurant?.cover_url ? 'Remover capa' : 'Alterar capa';
    }
}

function openCategoriesModal() {
    renderCategoriesModal();
    qs('categoriesModal').hidden = false;
}

function closeCategoriesModal() {
    qs('categoriesModal').hidden = true;
}

function addCategoryRow(value = 'Nova categoria') {
    const list = qs('categoriesList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.originalCategory = '';
    row.innerHTML = `
        <input class="category-row-input" type="text" value="${escapeHTML(value)}" spellcheck="false">
        <div class="category-row-actions">
            <button class="row-icon-btn" type="button" data-action="category-row-move"
                data-direction="-1" aria-label="Mover para cima" title="Mover para cima">
                <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button class="row-icon-btn" type="button" data-action="category-row-move"
                data-direction="1" aria-label="Mover para baixo" title="Mover para baixo">
                <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button class="row-icon-btn row-icon-btn-danger" type="button"
                data-action="category-row-delete" aria-label="Apagar categoria" title="Apagar categoria">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    list.appendChild(row);
    row.querySelector('input')?.focus();
    updateCategoryModalControls();
}

function updateCategoryModalControls() {
    const rows = Array.from(qs('categoriesList')?.querySelectorAll('.category-row') || []);
    rows.forEach((row, index) => {
        const up = row.querySelector('[data-direction="-1"]');
        const down = row.querySelector('[data-direction="1"]');
        if (up) up.disabled = index === 0;
        if (down) down.disabled = index === rows.length - 1;
    });
}

function moveCategoryRow(row, direction) {
    if (!row) return;
    const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) {
        row.parentNode.insertBefore(row, sibling);
    } else {
        row.parentNode.insertBefore(sibling, row);
    }
    updateCategoryModalControls();
}

function deleteCategoryRow(row) {
    row?.remove();
    updateCategoryModalControls();
}

async function saveHeroModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const updates = readRestaurantForm();
    const normalized = {};
    Object.entries(updates).forEach(([key, value]) => {
        normalized[key] = value;
    });

    const changed = Object.entries(normalized).some(([key, value]) => String(value || '') !== String(app.restaurant[key] || ''));
    if (!changed) {
        closeHeroModal();
        return;
    }

    setSaveStatus('A guardar restaurante...');
    const { error } = await app.supabase
        .from('restaurants')
        .update(normalized)
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('NÃ£o foi possÃ­vel guardar');
        return;
    }

    Object.assign(app.restaurant, normalized);
    renderDashboard();
    closeHeroModal();
    setSaveStatus('Restaurante guardado', true);
}

async function saveCategoriesModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const rows = Array.from(qs('categoriesList').querySelectorAll('.category-row')).map((row) => ({
        original: row.dataset.originalCategory || '',
        name: row.querySelector('.category-row-input')?.value.trim() || '',
    }));

    const names = rows.map((row) => row.name).filter(Boolean);
    if (!names.length) {
        setSaveStatus('Adiciona pelo menos uma categoria');
        return;
    }

    if (new Set(names).size !== names.length) {
        setSaveStatus('Não podem existir categorias repetidas');
        return;
    }

    const nextOrder = names;
    const nextImages = { ...(app.restaurant.category_images || {}) };
    const currentCategories = getCategories();
    const activeWasRenamed = rows.find((row) => row.original === app.activeCategory && row.name);
    const activeWasDeleted = app.activeCategory && !nextOrder.includes(app.activeCategory);

    setSaveStatus('A guardar categorias...');

    for (const row of rows) {
        if (!row.original || !row.name || row.original === row.name) continue;
        const { error } = await app.supabase
            .from('menu_items')
            .update({ category: row.name })
            .eq('restaurant_id', app.restaurant.id)
            .eq('category', row.original);
        if (error) {
            console.error(error);
            setSaveStatus('Não foi possível guardar');
            return;
        }
        if (nextImages[row.original]) {
            nextImages[row.name] = nextImages[row.original];
            delete nextImages[row.original];
        }
    }

    const deletedCategories = currentCategories.filter((category) => !nextOrder.includes(category));
    for (const category of deletedCategories) {
        await app.supabase
            .from('menu_items')
            .delete()
            .eq('restaurant_id', app.restaurant.id)
            .eq('category', category);
        delete nextImages[category];
    }

    const { error } = await app.supabase
        .from('restaurants')
        .update({
            category_order: nextOrder,
            category_images: nextImages,
        })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    app.restaurant.category_order = nextOrder;
    app.restaurant.category_images = nextImages;
    app.activeCategory = activeWasRenamed ? activeWasRenamed.name : (activeWasDeleted ? nextOrder[0] || null : app.activeCategory);
    closeCategoriesModal();
    await loadDashboardData();
    setSaveStatus('Categorias guardadas', true);
}

function renderActiveCategory(categories) {
    const editor = qs('categoryEditor');
    if (!editor) return;

    if (!categories.length || !app.activeCategory) {
        editor.innerHTML = `
            <div class="empty-menu">
                <p>O menu ainda nÃ£o tem categorias.</p>
                <button type="button" data-action="open-categories-modal" aria-label="Abrir editor de categorias">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;
        return;
    }

    const category = app.activeCategory;
    const items = itemsForCategory(category);
    const encodedCategory = encodeURIComponent(category);

    editor.innerHTML = `
        <div class="slide-content">
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
    qs('openLiveBtn').href = getLiveMenuUrl();

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
        setSaveStatus('NÃ£o foi possÃ­vel guardar');
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
        setSaveStatus('NÃ£o foi possÃ­vel criar');
        return;
    }

    app.restaurant.category_order = order;
    app.activeCategory = name;
    renderDashboard();
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
            setSaveStatus('NÃ£o foi possÃ­vel carregar');
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
    } else {
        const choice = window.prompt('O que queres editar? Escreve: wifi ou telefone', 'wifi');
        if (!choice) return;
        const normalized = choice.trim().toLowerCase();
        if (normalized === 'wifi') return editInfoBadge('wifi');
        if (normalized === 'telefone') return editInfoBadge('phone');
        return;
    }

    setSaveStatus('A guardar informaÃ§Ãµes...');
    const { error } = await app.supabase
        .from('restaurants')
        .update(updates)
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        setSaveStatus('NÃ£o foi possÃ­vel guardar');
        return;
    }

    Object.assign(app.restaurant, updates);
    renderInfoBadges();
    setSaveStatus('InformaÃ§Ãµes guardadas', true);
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

function setModalItemImage(item) {
    const preview = qs('itemModalImagePreview');
    const button = qs('itemModalImageBtn');
    if (!preview || !button) return;

    const hasItem = Boolean(item?.id);
    preview.src = item?.image_url || ITEM_PLACEHOLDER_IMAGE;
    button.dataset.itemId = item?.id || '';
    button.disabled = !hasItem;
    button.title = hasItem
        ? 'Editar imagem do prato'
        : 'Guarda o prato para poder editar a imagem';
    button.setAttribute('aria-label', button.title);
}

function openItemModal(item = null, category = app.activeCategory) {
    qs('itemModalTitle').textContent = item ? 'Editar prato' : 'Adicionar prato';
    qs('itemIdInput').value = item?.id || '';
    qs('itemNameInput').value = item?.name || '';
    qs('itemPriceInput').value = item ? Number(item.price || 0).toFixed(2) : '';
    qs('itemDescInput').value = item?.description || '';
    populateCategorySelect(item?.category || category);
    setModalItemImage(item);
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
        setSaveStatus('NÃ£o foi possÃ­vel guardar');
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
    setSaveStatus(available ? 'Prato visÃ­vel' : 'Prato oculto', true);
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
            setSaveStatus('NÃ£o foi possÃ­vel carregar');
            return;
        }

        await app.supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', id);
        await loadDashboardData();
        if (!qs('itemModal').hidden) {
            setModalItemImage(app.items.find((item) => String(item.id) === String(id)));
        }
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
        setSaveStatus('NÃ£o foi possÃ­vel carregar');
        return;
    }

    await app.supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', app.restaurant.id);
    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalCoverPreview();
    setSaveStatus('Capa guardada', true);
}

async function removeCover() {
    if (!app.restaurant.cover_url || !window.confirm('Remover a capa do menu?')) return;
    await app.supabase.from('restaurants').update({ cover_url: null }).eq('id', app.restaurant.id);
    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalCoverPreview();
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

    if (action === 'select-category') {
        app.activeCategory = actionElement.dataset.category;
        renderDashboard();
    } else if (action === 'open-hero-modal') {
        openHeroModal();
    } else if (action === 'open-categories-modal') {
        openCategoriesModal();
    } else if (action === 'add-item') {
        openItemModal(null, category);
    } else if (action === 'edit-item') {
        openItemModal(app.items.find((item) => String(item.id) === String(itemId)));
    }
}

function bindEvents() {
    qs('heroHeader').addEventListener('click', handleEditorClick);
    qs('categoryTabs').addEventListener('click', handleEditorClick);
    qs('categoryEditor').addEventListener('click', handleEditorClick);

    qs('heroForm').addEventListener('submit', saveHeroModal);
    qs('appearanceForm').addEventListener('submit', saveAppearanceModal);
    qs('fontForm').addEventListener('submit', saveFontModal);
    qs('categoriesForm').addEventListener('submit', saveCategoriesModal);
    qs('addCategoryRowBtn').addEventListener('click', () => addCategoryRow());
    qs('openAppearanceBtn').addEventListener('click', openAppearanceModal);
    qs('openFontBtn').addEventListener('click', openFontModal);
    qs('openQrBtn').addEventListener('click', openQrModal);
    qs('fontSelect').addEventListener('change', updateFontPreview);
    qs('downloadQrPngBtn').addEventListener('click', downloadQrPng);
    qs('downloadQrPdfBtn').addEventListener('click', downloadQrPdf);
    qs('heroCoverPreview').addEventListener('click', () => qs('heroCoverInput').click());
    qs('heroCoverPreview').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            qs('heroCoverInput').click();
        }
    });
    qs('heroCoverActionBtn').addEventListener('click', (event) => {
        event.stopPropagation();
        if (app.restaurant?.cover_url) {
            removeCover();
        } else {
            qs('heroCoverInput').click();
        }
    });
    qs('heroCoverInput').addEventListener('change', (event) => uploadCover(event.target));
    qs('categoriesModal').addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;
        const row = actionElement.closest('.category-row');

        if (actionElement.dataset.action === 'category-row-move') {
            moveCategoryRow(row, Number(actionElement.dataset.direction));
        } else if (actionElement.dataset.action === 'category-row-delete') {
            deleteCategoryRow(row);
        }
    });

    qs('editCoverBtn').addEventListener('click', () => qs('coverInput').click());
    qs('coverPlaceholder').addEventListener('click', () => qs('coverInput').click());
    qs('coverInput').addEventListener('change', (event) => uploadCover(event.target));
    qs('removeCoverBtn').addEventListener('click', removeCover);
    qs('itemModalImageBtn').addEventListener('click', () => {
        const itemId = qs('itemIdInput').value;
        if (!itemId) return;
        uploadItemImage(itemId);
    });
    qs('refreshMenuBtn').addEventListener('click', loadDashboardData);
    qs('itemForm').addEventListener('submit', saveItem);
    document.querySelectorAll('[data-close-modal]').forEach((button) =>
        button.addEventListener('click', (event) => {
            const modal = event.currentTarget.closest('.modal-backdrop');
            if (modal) modal.hidden = true;
        }));
    qs('itemModal').addEventListener('click', (event) => {
        if (event.target === qs('itemModal')) closeItemModal();
    });
    qs('heroModal').addEventListener('click', (event) => {
        if (event.target === qs('heroModal')) closeHeroModal();
    });
    qs('categoriesModal').addEventListener('click', (event) => {
        if (event.target === qs('categoriesModal')) closeCategoriesModal();
    });
    qs('appearanceModal').addEventListener('click', (event) => {
        if (event.target === qs('appearanceModal')) closeAppearanceModal();
    });
    qs('fontModal').addEventListener('click', (event) => {
        if (event.target === qs('fontModal')) closeFontModal();
    });
    qs('qrModal').addEventListener('click', (event) => {
        if (event.target === qs('qrModal')) closeQrModal();
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
