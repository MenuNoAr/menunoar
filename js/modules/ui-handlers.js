/**
 * ui-handlers.js - Slider Edition Handlers
 */
import { state } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

// Init active index if not exists
if (state.activeCategoryIdx === undefined) state.activeCategoryIdx = 0;

window.switchCategory = (idx) => {
    state.activeCategoryIdx = idx;
    const slider = document.getElementById('categorySlider');
    if (slider) {
        slider.style.transform = `translateX(-${idx * 100}%)`;
    }
    // Update active state
    document.querySelectorAll('.cat-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
    });
};

window.handleRestUpdate = async (field, value) => {
    const newVal = value.trim();
    if (!newVal || newVal === state.currentData[field]) return;
    await state.supabase.from('restaurants').update({ [field]: newVal }).eq('id', state.restaurantId);
    state.currentData[field] = newVal;
};

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
    while (existing.has(name)) name = `Categoria ${++counter}`;

    const newOrder = [...(state.currentData.category_order || []), name];
    await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);

    // Auto-create first item
    await state.supabase.from('menu_items').insert([{
        name: 'Novo Prato...',
        price: 0,
        description: 'Descrição...',
        category: name,
        restaurant_id: state.restaurantId,
        available: true
    }]);

    await loadData();
    // After reload, switch to the new one (the last one)
    const cats = Array.from(new Set(state.menuItems.map(i => i.category)));
    window.switchCategory(cats.length - 1);
};

window.deleteCategory = async (catName) => {
    if (!confirm(`Apagar a categoria "${catName}" e todos os seus pratos?`)) return;
    await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);
    const order = (state.currentData.category_order || []).filter(c => c !== catName);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    state.activeCategoryIdx = 0; // Reset to first
    loadData();
};

window.handleItemUpdate = async (id, field, value) => {
    const newVal = value.trim();
    const item = state.menuItems.find(i => i.id == id);
    if (item && item[field] === newVal) return;
    await state.supabase.from('menu_items').update({ [field]: newVal }).eq('id', id);
    if (item) item[field] = newVal;
};

window.handleItemPriceUpdate = async (id, rawValue) => {
    const cleaned = rawValue.replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    if (isNaN(val)) return loadData();
    await state.supabase.from('menu_items').update({ price: val }).eq('id', id);
    const item = state.menuItems.find(i => i.id == id);
    if (item) item.price = val;
};

window.addNewItem = async (cat) => {
    await state.supabase.from('menu_items').insert([{
        name: 'Novo Prato...',
        price: 0,
        description: 'Descrição aqui...',
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
    if (!confirm("Remover este prato?")) return;
    await state.supabase.from('menu_items').delete().eq('id', id);
    loadData();
};

window.triggerCoverUpload = () => { /* reuse previous implementation if needed or update */ };

window.triggerItemImageUpload = (itemId) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const { data, error } = await uploadFile(file, `item-${itemId}`);
        if (!error && data) {
            await state.supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', itemId);
            loadData();
        }
    };
    input.click();
};

window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';
};

window.openSettingsModal = () => document.getElementById('settingsModal').style.display = 'flex';
window.openProfileModal = () => document.getElementById('profileModal').style.display = 'flex';
window.openQrModal = () => {
    const modal = document.getElementById('qrModal');
    modal.style.display = 'flex';
    const container = document.getElementById('qr-code-container');
    container.innerHTML = '';
    const qr = new QRCodeStyling({
        width: 200, height: 200, data: `https://menunoar.pt/menu.html?id=${state.currentData.slug}`,
        dotsOptions: { color: "#000", type: "rounded" }, backgroundOptions: { color: "#FFF" }
    });
    qr.append(container);
    window._qr = qr;
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.signOut = async () => {
    await state.supabase.auth.signOut();
    window.location.href = 'login.html';
};
