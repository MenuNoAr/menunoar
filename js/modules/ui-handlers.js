/**
 * ui-handlers.js - Studio Edition
 * Creative interactions, glowing states, and cinematic modal transitions.
 */
import { state } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

// ─── NAV & VIEWPORT ───
window.switchView = (view) => {
    // Current only editor is handled here, other views via modals
    console.log(`Switching to ${view}`);
};

window.setPreviewSize = (mode) => {
    const app = document.getElementById('main-dashboard');
    const btns = document.querySelectorAll('.view-btn');
    btns.forEach(b => b.classList.remove('active'));

    if (mode === 'tablet') {
        app.classList.add('tablet-mode');
        document.querySelector('.view-btn[onclick*="tablet"]').classList.add('active');
    } else {
        app.classList.remove('tablet-mode');
        document.querySelector('.view-btn[onclick*="mobile"]').classList.add('active');
    }
};

// ─── CATEGORIES ───
window.handleCategoryRename = async (oldName, rawNew) => {
    const newName = rawNew.trim();
    if (!newName || newName === oldName) return;

    // Fast local update for responsive feel
    const order = (state.currentData.category_order || []).map(c => c === oldName ? newName : c);

    await state.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('restaurant_id', state.restaurantId);

    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    loadData();
};

window.addNewCategoryOptimized = async () => {
    const existing = new Set([
        ...state.menuItems.map(i => i.category),
        ...(state.currentData.category_order || []),
    ]);

    let name = 'Nova Categoria', counter = 1;
    while (existing.has(name)) name = `Nova Categoria ${++counter}`;

    const newOrder = [...(state.currentData.category_order || []), name];
    await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);
    loadData();
};

window.deleteCategory = async (catName) => {
    if (!confirm(`Deseja remover a categoria "${catName}" e todos os seus items?`)) return;

    await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);
    const order = (state.currentData.category_order || []).filter(c => c !== catName);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    loadData();
};

// ─── ITEMS ───
window.openItemModal = (id) => {
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;

    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemCat').value = item.category;
    document.getElementById('editItemVisibility').value = String(item.available);
    document.getElementById('editItemId').value = item.id;

    document.getElementById('modalTitle').textContent = 'Editar Produto';
    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
};

window.openAddItemModal = (cat) => {
    ['editItemName', 'editItemPrice', 'editItemDesc', 'editItemId'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editItemCat').value = cat;
    document.getElementById('editItemVisibility').value = 'true';
    document.getElementById('modalTitle').textContent = 'Novo Prato';

    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
};

document.getElementById('itemEditForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const isEditing = !!id;

    const payload = {
        name: document.getElementById('editItemName').value,
        price: parseFloat(document.getElementById('editItemPrice').value),
        description: document.getElementById('editItemDesc').value,
        available: document.getElementById('editItemVisibility').value === 'true',
        category: document.getElementById('editItemCat').value,
        restaurant_id: state.restaurantId
    };

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner fa-spin"></i> Gravando...';

    if (isEditing) {
        const { restaurant_id, ...updatePayload } = payload;
        await state.supabase.from('menu_items').update(updatePayload).eq('id', id);
    } else {
        await state.supabase.from('menu_items').insert([payload]);
    }

    window.closeModal('itemModal');
    loadData();
};

// ─── IMAGES ───
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

// ─── SETTINGS & PROFILE ───
window.openSettingsModal = (tab = 'design') => {
    console.log(`Setting up ${tab} settings...`);
    // Need to implement the settings modal logic here or in separate tabs
    // For now, let's keep it simple
    document.getElementById('trialTimer').click(); // Placeholder logic
};

window.openQrModal = () => {
    window.closeAllModals();
    // Logic for QR generation
    alert("Gerando QR Studio...");
};

window.openProfileModal = () => {
    window.closeAllModals();
    document.getElementById('profileModal').classList.add('open');
};

window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';

    // Invert Logo if needed
    const logo = document.getElementById('studioLogo');
    if (logo) logo.style.filter = isDark ? 'invert(1)' : 'none';
};

window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
window.closeAllModals = () => document.querySelectorAll('.modal-root').forEach(m => m.classList.remove('open'));

window.signOut = async () => {
    const { supabase } = state;
    await supabase.auth.signOut();
    window.location.href = 'login.html';
};
