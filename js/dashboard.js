import { getSupabase, initAuthListener, signOut } from './auth-service.js';
import { initUploadService, uploadFile } from './upload-service.js';

const app = {
    supabase: null,
    user: null,
    restaurant: null,
    items: [],
    previewTimer: null,
    previewReady: false,
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (m) => ESC[m]);
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function qs(id) {
    return document.getElementById(id);
}

function getCategories() {
    const catSet = new Set(app.items.map((i) => i.category).filter(Boolean));
    (app.restaurant?.category_order || []).forEach((c) => catSet.add(c));
    const cats = Array.from(catSet);

    if (app.restaurant?.category_order?.length) {
        const order = app.restaurant.category_order;
        cats.sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
        });
    }

    return cats;
}

function itemsForCategory(cat) {
    return app.items
        .filter((item) => item.category === cat)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt'));
}

function setPreviewStatus(text) {
    const el = qs('previewStatus');
    if (el) el.textContent = text;
}

function schedulePreviewRefresh() {
    clearTimeout(app.previewTimer);
    setPreviewStatus('A sincronizar...');
    app.previewTimer = setTimeout(() => {
        refreshPreview();
    }, 180);
}

function refreshPreview() {
    const frame = qs('menuPreviewFrame');
    const overlay = qs('previewOverlay');
    if (!frame || !app.restaurant?.slug) return;

    const url = `menu.html?id=${encodeURIComponent(app.restaurant.slug)}&v=${Date.now()}`;
    app.previewReady = false;
    if (overlay) overlay.style.display = 'grid';
    frame.onload = () => {
        app.previewReady = true;
        if (overlay) overlay.style.display = 'none';
        setPreviewStatus('Sincronizado');
    };
    frame.src = url;
    const liveBtn = qs('openLiveBtn');
    if (liveBtn) liveBtn.href = `menu.html?id=${encodeURIComponent(app.restaurant.slug)}`;
}

function renderStaticState() {
    const shell = qs('dashboardShell');
    const loading = qs('authLoading');
    const empty = qs('emptyState');
    if (shell) shell.hidden = false;
    if (loading) loading.hidden = true;
    if (empty) empty.hidden = true;
}

function renderEmptyState() {
    const shell = qs('dashboardShell');
    const empty = qs('emptyState');
    const loading = qs('authLoading');
    if (shell) shell.hidden = true;
    if (empty) empty.hidden = false;
    if (loading) loading.hidden = true;
}

function renderDashboard() {
    if (!app.restaurant) return;

    renderStaticState();

    const rest = app.restaurant;
    const nameInput = qs('restaurantNameInput');
    const descInput = qs('restaurantDescInput');
    const slugText = qs('slugText');
    const menuTypeChip = qs('menuTypeChip');
    const sessionPill = qs('sessionPill');

    if (nameInput) nameInput.value = rest.name || '';
    if (descInput) descInput.value = rest.description || '';
    if (slugText) slugText.textContent = rest.slug || '-';
    if (sessionPill) sessionPill.textContent = app.user?.email || 'Sessao autenticada';

    if (menuTypeChip) {
        menuTypeChip.textContent = rest.menu_type === 'pdf' ? 'PDF' : 'Digital';
    }

    const coverPreview = qs('coverPreview');
    const coverEmpty = qs('coverEmpty');
    if (coverPreview) {
        if (rest.cover_url) {
            coverPreview.classList.add('has-image');
            coverPreview.style.backgroundImage = `url('${rest.cover_url}')`;
            if (coverEmpty) coverEmpty.hidden = true;
        } else {
            coverPreview.classList.remove('has-image');
            coverPreview.style.backgroundImage = '';
            if (coverEmpty) coverEmpty.hidden = false;
        }
    }

    const categories = getCategories();
    const categoryList = qs('categoryList');
    const categorySections = qs('categorySections');

    if (categoryList) {
        categoryList.innerHTML = categories.length
            ? categories.map((cat, index) => {
                const catImg = (rest.category_images || {})[cat];
                return `
                    <div class="category-row">
                        <div class="category-row-main">
                            <div class="category-row-top">
                                <input type="text" value="${escapeHTML(cat)}"
                                    onchange="renameCategory(${JSON.stringify(cat)}, this.value)">
                                <div class="category-actions">
                                    <button class="icon-btn" type="button" title="Subir"
                                        onclick="moveCategory(${JSON.stringify(cat)}, -1)">
                                        <i class="fa-solid fa-arrow-up"></i>
                                    </button>
                                    <button class="icon-btn" type="button" title="Descer"
                                        onclick="moveCategory(${JSON.stringify(cat)}, 1)">
                                        <i class="fa-solid fa-arrow-down"></i>
                                    </button>
                                    <button class="icon-btn" type="button" title="Apagar"
                                        onclick="deleteCategory(${JSON.stringify(cat)})">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="category-banner-thumb ${catImg ? 'has-image' : ''}"
                                style="${catImg ? `background-image:url('${catImg}')` : ''}">
                                ${catImg ? '' : '<span>Sem banner</span>'}
                            </div>
                        </div>
                        <div class="category-actions">
                            <button class="icon-btn" type="button" title="Banner"
                                onclick="uploadCategoryBanner(${JSON.stringify(cat)})">
                                <i class="fa-solid fa-image"></i>
                            </button>
                            <button class="icon-btn" type="button" title="Remover banner"
                                onclick="removeCategoryBanner(${JSON.stringify(cat)})">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                        </div>
                    </div>`;
            }).join('')
            : '<div class="empty-note">Ainda nao ha categorias. Adiciona a primeira abaixo.</div>';
    }

    if (categorySections) {
        if (rest.menu_type === 'pdf') {
            categorySections.innerHTML = `
                <div class="pdf-note">
                    Este restaurante esta em modo PDF. A edicao de categorias e pratos fica desativada nesta vista.
                </div>
            `;
        } else {
            categorySections.innerHTML = categories.length
                ? categories.map((cat) => {
                    const catImg = (rest.category_images || {})[cat];
                    const items = itemsForCategory(cat);
                    return `
                        <section class="category-section">
                            <div class="category-section-head">
                                <div class="panel-head">
                                    <div>
                                        <span class="panel-kicker">Categoria</span>
                                        <h2>${escapeHTML(cat)}</h2>
                                    </div>
                                    <span class="panel-chip subtle">${items.length} pratos</span>
                                </div>
                                <div class="category-banner-thumb ${catImg ? 'has-image' : ''}"
                                    style="${catImg ? `background-image:url('${catImg}')` : ''}">
                                    ${catImg ? '' : '<span>Banner da categoria</span>'}
                                </div>
                                <div class="category-banner-controls">
                                    <button class="btn btn-ghost small" type="button"
                                        onclick="uploadCategoryBanner(${JSON.stringify(cat)})">
                                        <i class="fa-solid fa-image"></i>
                                        <span>Alterar banner</span>
                                    </button>
                                    <button class="btn btn-ghost small" type="button"
                                        onclick="removeCategoryBanner(${JSON.stringify(cat)})">
                                        <i class="fa-solid fa-trash"></i>
                                        <span>Remover banner</span>
                                    </button>
                                    <button class="btn btn-danger-soft small" type="button"
                                        onclick="deleteCategory(${JSON.stringify(cat)})">
                                        <i class="fa-solid fa-trash"></i>
                                        <span>Apagar categoria</span>
                                    </button>
                                </div>
                            </div>
                            <div class="category-items">
                                ${items.map((item) => renderItemRow(item)).join('')}
                                ${renderQuickAdd(cat)}
                            </div>
                        </section>`;
                }).join('')
                : '<div class="empty-note">Ainda nao ha pratos. Usa o formulario de adicao rapida em baixo.</div>';
        }
    }

    const openLiveBtn = qs('openLiveBtn');
    if (openLiveBtn) {
        openLiveBtn.href = `menu.html?id=${encodeURIComponent(rest.slug)}`;
    }

    refreshPreview();
    setPreviewStatus('A sincronizar...');
}

function renderItemRow(item) {
    const safeId = JSON.stringify(item.id);
    return `
        <article class="item-row">
            <div class="item-main">
                <div class="item-top">
                    <input type="text" value="${escapeHTML(item.name || '')}"
                        onchange="saveItemField(${safeId}, 'name', this.value)">
                    <input type="text" value="${Number(item.price || 0).toFixed(2)}"
                        onchange="saveItemField(${safeId}, 'price', this.value)">
                    <label class="switch">
                        <input type="checkbox" ${item.available ? 'checked' : ''}
                            onchange="toggleAvailability(${safeId}, this.checked)">
                        <span>${item.available ? 'Ativo' : 'Oculto'}</span>
                    </label>
                </div>
                <div class="item-meta">
                    <textarea rows="2" placeholder="Descricao"
                        onchange="saveItemField(${safeId}, 'description', this.value)">${escapeHTML(item.description || '')}</textarea>
                    <div class="item-meta-row">
                        <button class="btn btn-ghost small" type="button" onclick="pickItemImage(${safeId})">
                            <i class="fa-solid fa-image"></i>
                            <span>${item.image_url ? 'Trocar imagem' : 'Adicionar imagem'}</span>
                        </button>
                        ${item.image_url
            ? `<button class="btn btn-danger-soft small" type="button" onclick="removeItemImage(${safeId})">
                                <i class="fa-solid fa-trash"></i>
                                <span>Remover imagem</span>
                           </button>`
            : ''}
                        <input id="itemImageInput-${item.id}" type="file" accept="image/*" hidden
                            onchange="uploadItemImage(${safeId}, this)">
                    </div>
                </div>
            </div>
            <div class="item-actions">
                <button class="icon-btn" type="button" title="Apagar prato"
                    onclick="deleteItem(${safeId})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </article>`;
}

function renderQuickAdd(category) {
    const safeId = slugify(category);
    return `
        <form class="inline-create" onsubmit="addItem(event, ${JSON.stringify(category)})">
            <input id="quickName-${safeId}" type="text" placeholder="Novo prato">
            <input id="quickPrice-${safeId}" type="text" placeholder="0.00">
            <textarea id="quickDesc-${safeId}" rows="2" placeholder="Descricao opcional"></textarea>
            <button class="btn btn-primary" type="submit">
                <i class="fa-solid fa-plus"></i>
                <span>Adicionar prato</span>
            </button>
        </form>`;
}

async function loadDashboardData() {
    if (!app.supabase || !app.user) return;

    const { data: restaurant, error: restError } = await app.supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', app.user.id)
        .maybeSingle();

    if (restError) {
        console.error('Erro ao carregar restaurante:', restError.message);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
        qs('dashboardShell').hidden = true;
        qs('emptyState').hidden = true;
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

    if (itemsError) {
        console.error('Erro ao carregar pratos:', itemsError.message);
    }

    app.restaurant = restaurant;
    app.items = items || [];

    renderDashboard();
}

async function saveRestaurantPatch(patch) {
    if (!app.restaurant) return;
    const { error } = await app.supabase
        .from('restaurants')
        .update(patch)
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        return;
    }

    app.restaurant = { ...app.restaurant, ...patch };
    schedulePreviewRefresh();
}

async function renameCategory(oldName, rawValue) {
    const newName = rawValue.trim();
    if (!newName || newName === oldName) {
        renderDashboard();
        return;
    }

    const { error } = await app.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('restaurant_id', app.restaurant.id)
        .eq('category', oldName);

    if (error) {
        console.error(error);
        return;
    }

    const updates = {};
    if (app.restaurant.category_images?.[oldName]) {
        const images = { ...app.restaurant.category_images };
        images[newName] = images[oldName];
        delete images[oldName];
        updates.category_images = images;
    }
    if (app.restaurant.category_order?.includes(oldName)) {
        updates.category_order = app.restaurant.category_order.map((c) => (c === oldName ? newName : c));
    }
    if (Object.keys(updates).length) {
        await app.supabase.from('restaurants').update(updates).eq('id', app.restaurant.id);
    }

    await loadDashboardData();
}

async function moveCategory(cat, direction) {
    const categories = getCategories();
    const index = categories.indexOf(cat);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= categories.length) return;

    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];

    const { error } = await app.supabase
        .from('restaurants')
        .update({ category_order: next })
        .eq('id', app.restaurant.id);

    if (error) {
        console.error(error);
        return;
    }

    app.restaurant.category_order = next;
    renderDashboard();
}

async function deleteCategory(cat) {
    if (!confirm(`Apagar a categoria "${cat}" e todos os pratos nela?`)) return;

    await app.supabase
        .from('menu_items')
        .delete()
        .eq('restaurant_id', app.restaurant.id)
        .eq('category', cat);

    const updates = {};
    if (app.restaurant.category_images?.[cat]) {
        const images = { ...app.restaurant.category_images };
        delete images[cat];
        updates.category_images = images;
    }
    if (app.restaurant.category_order?.includes(cat)) {
        updates.category_order = app.restaurant.category_order.filter((c) => c !== cat);
    }

    if (Object.keys(updates).length) {
        await app.supabase.from('restaurants').update(updates).eq('id', app.restaurant.id);
    }

    await loadDashboardData();
}

async function uploadCategoryBanner(cat) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
        if (!input.files?.length) return;
        const { data, error } = await uploadFile(input.files[0], `cat-${slugify(cat)}`);
        if (error || !data) {
            console.error(error);
            return;
        }

        const images = { ...(app.restaurant.category_images || {}), [cat]: data.publicUrl };
        await app.supabase.from('restaurants').update({ category_images: images }).eq('id', app.restaurant.id);
        await loadDashboardData();
    };
    input.click();
}

async function removeCategoryBanner(cat) {
    const images = { ...(app.restaurant.category_images || {}) };
    if (!images[cat]) return;
    delete images[cat];
    await app.supabase.from('restaurants').update({ category_images: images }).eq('id', app.restaurant.id);
    await loadDashboardData();
}

async function addCategory(event) {
    event.preventDefault();
    const input = qs('newCategoryInput');
    const name = input?.value.trim();
    if (!name) return;

    const order = Array.from(new Set([...(app.restaurant.category_order || []), ...getCategories(), name]));

    await app.supabase
        .from('restaurants')
        .update({ category_order: order })
        .eq('id', app.restaurant.id);

    if (input) input.value = '';
    await loadDashboardData();
}

async function saveItemField(id, field, rawValue) {
    const patch = {};
    let value = rawValue.trim();

    if (field === 'price') {
        const normalized = parseFloat(value.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (Number.isNaN(normalized)) {
            await loadDashboardData();
            return;
        }
        value = normalized;
    }

    patch[field] = value;

    const { error } = await app.supabase.from('menu_items').update(patch).eq('id', id);
    if (error) {
        console.error(error);
        return;
    }

    const item = app.items.find((entry) => String(entry.id) === String(id));
    if (item) item[field] = value;
    schedulePreviewRefresh();
}

async function toggleAvailability(id, checked) {
    const { error } = await app.supabase
        .from('menu_items')
        .update({ available: checked })
        .eq('id', id);

    if (error) {
        console.error(error);
        return;
    }

    const item = app.items.find((entry) => String(entry.id) === String(id));
    if (item) item.available = checked;
    schedulePreviewRefresh();
}

async function deleteItem(id) {
    if (!confirm('Apagar este prato?')) return;
    await app.supabase.from('menu_items').delete().eq('id', id);
    await loadDashboardData();
}

function pickItemImage(id) {
    const input = qs(`itemImageInput-${id}`);
    if (input) input.click();
}

async function uploadItemImage(id, input) {
    if (!input.files?.length) return;
    const { data, error } = await uploadFile(input.files[0], `item-${id}`);
    if (error || !data) {
        console.error(error);
        return;
    }

    await app.supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', id);
    await loadDashboardData();
}

async function removeItemImage(id) {
    await app.supabase.from('menu_items').update({ image_url: null }).eq('id', id);
    await loadDashboardData();
}

async function addItem(event, category) {
    event.preventDefault();
    const key = slugify(category);
    const name = qs(`quickName-${key}`)?.value.trim();
    const priceRaw = qs(`quickPrice-${key}`)?.value.trim() || '0';
    const desc = qs(`quickDesc-${key}`)?.value.trim() || '';

    if (!name) return;

    const price = parseFloat(priceRaw.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;

    const payload = {
        restaurant_id: app.restaurant.id,
        category,
        name,
        description: desc,
        price,
        available: true,
    };

    const { error } = await app.supabase.from('menu_items').insert([payload]);
    if (error) {
        console.error(error);
        return;
    }

    const nameInput = qs(`quickName-${key}`);
    const priceInput = qs(`quickPrice-${key}`);
    const descInput = qs(`quickDesc-${key}`);
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (descInput) descInput.value = '';

    await loadDashboardData();
}

async function createRestaurantBannerUpload() {
    const input = qs('coverInput');
    if (input) input.click();
}

async function uploadCover(input) {
    if (!input.files?.length) return;
    const { data, error } = await uploadFile(input.files[0], 'cover');
    if (error || !data) {
        console.error(error);
        return;
    }

    await saveRestaurantPatch({ cover_url: data.publicUrl });
    await loadDashboardData();
}

async function removeCover() {
    await saveRestaurantPatch({ cover_url: null });
    await loadDashboardData();
}

async function copySlug() {
    if (!app.restaurant?.slug) return;
    const url = `${window.location.origin}/menu.html?id=${app.restaurant.slug}`;
    await navigator.clipboard.writeText(url);
    setPreviewStatus('Link copiado');
    setTimeout(() => setPreviewStatus('Sincronizado'), 1200);
}

async function init() {
    try {
        const supabase = await getSupabase();
        if (!supabase) {
            qs('authError').hidden = false;
            qs('authLoading').hidden = true;
            return;
        }

        app.supabase = supabase;
        initUploadService(supabase);

        initAuthListener(async (user) => {
            app.user = user;
            const loading = qs('authLoading');
            if (loading) loading.hidden = false;
            await loadDashboardData();
            if (loading) loading.hidden = true;
        }, () => {
            window.location.href = 'login.html';
        });

        qs('refreshPreviewBtn')?.addEventListener('click', () => refreshPreview());
        qs('copySlugBtn')?.addEventListener('click', copySlug);
        qs('uploadCoverBtn')?.addEventListener('click', createRestaurantBannerUpload);
        qs('removeCoverBtn')?.addEventListener('click', removeCover);
        qs('coverInput')?.addEventListener('change', (e) => uploadCover(e.target));
        qs('newCategoryForm')?.addEventListener('submit', addCategory);
        qs('restaurantNameInput')?.addEventListener('blur', (e) => saveRestaurantPatch({ name: e.target.value.trim() }));
        qs('restaurantDescInput')?.addEventListener('blur', (e) => saveRestaurantPatch({ description: e.target.value.trim() }));

        window.renameCategory = renameCategory;
        window.moveCategory = moveCategory;
        window.deleteCategory = deleteCategory;
        window.uploadCategoryBanner = uploadCategoryBanner;
        window.removeCategoryBanner = removeCategoryBanner;
        window.saveItemField = saveItemField;
        window.toggleAvailability = toggleAvailability;
        window.deleteItem = deleteItem;
        window.pickItemImage = pickItemImage;
        window.uploadItemImage = uploadItemImage;
        window.removeItemImage = removeItemImage;
        window.addItem = addItem;
        window.signOut = () => signOut();
    } catch (error) {
        console.error('Dashboard init error:', error);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
    }
}

window.signOut = () => signOut();

init();
