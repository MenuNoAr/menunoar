/**
 * ui-handlers.js - Zen Editor Logic
 */
import { state } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

// ─── GLOBAL RESTAURANT UPDATES ───
window.handleRestUpdate = async (field, value) => {
    const newVal = value.trim();
    if (!newVal || newVal === state.currentData[field]) return;

    await state.supabase.from('restaurants').update({ [field]: newVal }).eq('id', state.restaurantId);
    state.currentData[field] = newVal;
    if (field === 'name') document.getElementById('sidebarUserName').innerText = newVal;
};

// ─── CATEGORIES ───
window.handleCategoryRename = async (oldName, rawNew) => {
    const newName = rawNew.trim();
    if (!newName || newName === oldName) return;

    await state.supabase.from('menu_items').update({ category: newName }).eq('category', oldName).eq('restaurant_id', state.restaurantId);

    const order = (state.currentData.category_order || []).map(c => c === oldName ? newName : c);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);

    loadData();
};

window.addNewCategoryOptimized = async () => {
    let name = 'Nova Categoria', counter = 1;
    const existing = new Set(state.menuItems.map(i => i.category));
    while (existing.has(name)) name = `Nova Categoria ${++counter}`;

    const newOrder = [...(state.currentData.category_order || []), name];
    await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);
    loadData();
};

window.deleteCategory = async (catName) => {
    if (!confirm(`Apagar categoria "${catName}"?`)) return;
    await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);
    const order = (state.currentData.category_order || []).filter(c => c !== catName);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    loadData();
};

// ─── ITEMS (Inline updates) ───
window.handleItemUpdate = async (id, field, value) => {
    const newVal = value.trim();
    const item = state.menuItems.find(i => i.id == id);
    if (item && item[field] === newVal) return;

    await state.supabase.from('menu_items').update({ [field]: newVal }).eq('id', id);
    // Don't reload full data for speed, just update local state
    if (item) item[field] = newVal;
};

window.handleItemPriceUpdate = async (id, rawValue) => {
    const val = parseFloat(rawValue.replace('€', '').trim());
    if (isNaN(val)) return loadData(); // reset on error

    await state.supabase.from('menu_items').update({ price: val }).eq('id', id);
};

window.addNewItem = async (cat) => {
    await state.supabase.from('menu_items').insert([{
        name: 'Novo Prato',
        price: 0,
        description: 'Breve descrição...',
        category: cat,
        restaurant_id: state.restaurantId,
        available: true
    }]);
    loadData();
};

window.toggleAvailability = async (id, current) => {
    await state.supabase.from('menu_items').update({ available: !current }).eq('id', id);
    loadData();
};

window.deleteItem = async (id) => {
    if (!confirm("Apagar este prato?")) return;
    await state.supabase.from('menu_items').delete().eq('id', id);
    loadData();
};

// ─── COVER ───
window.triggerCoverUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const { data, error } = await uploadFile(file, 'cover');
        if (!error && data) {
            await state.supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', state.restaurantId);
            loadData();
        }
    };
    input.click();
};

// ─── MODALS & THEME ───
window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';
};

window.openProfileModal = () => {
    document.getElementById('profileEmail').innerText = state.currentUser.email;
    document.getElementById('profileModal').style.display = 'flex';
};

window.openQrModal = () => {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'flex';
    const container = document.getElementById('qr-code-container');
    container.innerHTML = '';
    const qr = new QRCodeStyling({
        width: 200, height: 200, data: `https://menunoar.pt/menu.html?id=${state.currentData.slug}`,
        dotsOptions: { color: "#000", type: "rounded" }, backgroundOptions: { color: "#fff" }
    });
    qr.append(container);
    window._qr = qr;
};

window.downloadQr = () => window._qr?.download({ name: "qr-menu", extension: "png" });

window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.signOut = async () => {
    await state.supabase.auth.signOut();
    window.location.href = 'login.html';
};
