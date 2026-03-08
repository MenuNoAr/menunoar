/**
 * ui-handlers.js - Hub Version
 */
import { state } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

// ─── GLOBAL WINDOW HANDLERS ───

window.handleCategoryRename = async (oldName, rawNew) => {
    const newName = rawNew.trim();
    if (!newName || newName === oldName) return;

    // Update items category
    await state.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('restaurant_id', state.restaurantId);

    // Update order
    if (state.currentData.category_order?.includes(oldName)) {
        const order = state.currentData.category_order.map(c => c === oldName ? newName : c);
        await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    }

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
    if (!confirm(`Apagar a categoria "${catName}" e todos os pratos nela contidos?`)) return;
    await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);
    const order = (state.currentData.category_order || []).filter(c => c !== catName);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    loadData();
};

// Items
window.openItemModal = (id) => {
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;

    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemCat').value = item.category;
    document.getElementById('editItemVisibility').value = String(item.available);
    document.getElementById('editItemId').value = item.id;

    document.getElementById('modalTitle').textContent = 'Editar Prato';
    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
};

window.openAddItemModal = (cat) => {
    ['editItemName', 'editItemPrice', 'editItemDesc', 'editItemId'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editItemCat').value = cat;
    document.getElementById('editItemVisibility').value = 'true';
    document.getElementById('modalTitle').textContent = 'Adicionar Prato';

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

    if (isEditing) {
        const { restaurant_id, ...updatePayload } = payload;
        await state.supabase.from('menu_items').update(updatePayload).eq('id', id);
    } else {
        await state.supabase.from('menu_items').insert([payload]);
    }

    window.closeModal('itemModal');
    loadData();
};

// Settings
window.switchSettingsTab = (tab) => {
    document.querySelectorAll('.m-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.m-nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).style.display = 'block';
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
};

window.openSettingsModal = () => {
    const data = state.currentData;
    document.getElementById('modalFont').value = data.font || 'Inter';
    document.getElementById('modalSlug').value = data.slug || '';
    document.getElementById('pdfToggle').checked = data.menu_type === 'pdf';

    window.togglePdfDetails();
    window.switchSettingsTab('design');

    window.closeAllModals();
    document.getElementById('settingsModal').classList.add('open');
};

window.togglePdfDetails = () => {
    const isPdf = document.getElementById('pdfToggle').checked;
    document.getElementById('pdfDetails').style.display = isPdf ? 'block' : 'none';
};

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const updates = {
        font: document.getElementById('modalFont').value,
        slug: document.getElementById('modalSlug').value.trim(),
        menu_type: document.getElementById('pdfToggle').checked ? 'pdf' : 'digital'
    };

    const fileInput = document.getElementById('pdfUploadInput');
    if (fileInput.files.length) {
        const { data, error } = await uploadFile(fileInput.files[0], 'manual-pdf', 'menu-pdfs');
        if (!error && data) updates.pdf_url = data.publicUrl;
    }

    await state.supabase.from('restaurants').update(updates).eq('id', state.restaurantId);
    window.location.reload();
};

window.togglePreviewMode = (mode) => {
    const container = document.getElementById('main-dashboard');
    if (mode === 'tablet') container.classList.add('tablet-mode');
    else container.classList.remove('tablet-mode');
};

window.promptDeleteRestaurant = async () => {
    const restName = state.currentData.name;
    if (confirm(`Deseja apagar o restaurante "${restName}"? Esta ação é permanente.`)) {
        await state.supabase.from('restaurants').delete().eq('id', state.restaurantId);
        window.location.reload();
    }
};

window.openQrModal = () => {
    window.closeAllModals();
    document.getElementById('qrModal').classList.add('open');
    document.getElementById('qrRestaurantName').textContent = state.currentData.name;

    const url = `https://menunoar.pt/menu.html?id=${state.currentData.slug}`;
    const qrDiv = document.getElementById('qr-code-container');
    qrDiv.innerHTML = '';
    const qr = new QRCodeStyling({
        width: 250, height: 250, data: url,
        dotsOptions: { color: "#000", type: "rounded" },
        backgroundOptions: { color: "#fff" }
    });
    qr.append(qrDiv);
    window._qrCurrent = qr;
};

window.downloadQr = () => window._qrCurrent?.download({ name: "qr-menu", extension: "png" });

window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = document.body.classList.contains('dark-mode') ? 'ph ph-sun' : 'ph ph-moon';
    }
};
