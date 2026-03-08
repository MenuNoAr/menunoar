/**
 * ui-handlers.js - Consolidated UI logic for the new dashboard
 */
import { state, updateState } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';
import { renderMenu } from './render.js';

// ─── Restaurant Global Updates ───
window.handleRestUpdate = async (field, value) => {
    const newVal = value.trim();
    if (!newVal || newVal === state.currentData[field]) return;

    await state.supabase
        .from('restaurants')
        .update({ [field]: newVal })
        .eq('id', state.restaurantId);

    state.currentData[field] = newVal;
    if (field === 'name') {
        const breadcrumb = document.getElementById('sidebarUserName');
        if (breadcrumb) breadcrumb.textContent = newVal;
    }
};

window.openBadgeEdit = (type) => {
    const labels = { wifi: 'Palavra-passe do Wi-Fi', phone: 'Contacto Telefónico', address: 'Morada / Localização' };
    const field = { wifi: 'wifi_password', phone: 'phone', address: 'address' }[type];
    const current = state.currentData[field] || '';

    const newVal = prompt(`Editar ${labels[type]}:`, current);
    if (newVal !== null) {
        window.handleRestUpdate(field, newVal);
        // We need to re-render header or just update the badge
        const badgeSpan = document.getElementById(`text${type.charAt(0).toUpperCase() + type.slice(1)}`);
        const badgeEl = document.getElementById(`badge${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (badgeSpan) badgeSpan.textContent = newVal || 'Adicionar...';
        if (badgeEl) badgeEl.style.opacity = newVal ? '1' : '0.4';
    }
};

// ─── Cover Image ───
window.triggerCoverUpload = () => document.getElementById('coverUpload')?.click();

window.handleCoverUpload = async (input) => {
    if (!input.files.length) return;
    const { data, error } = await uploadFile(input.files[0], 'cover');
    if (!error && data) {
        await state.supabase
            .from('restaurants')
            .update({ cover_url: data.publicUrl })
            .eq('id', state.restaurantId);
        loadData();
    }
};

// ─── Categories ───
window.addNewCategoryOptimized = async () => {
    const existing = new Set([
        ...state.menuItems.map(i => i.category),
        ...(state.currentData.category_order || []),
    ]);

    let name = 'Nova Categoria', counter = 1;
    while (existing.has(name)) name = `Nova Categoria ${++counter}`;

    const newOrder = [...(state.currentData.category_order || []), name];
    state.currentData.category_order = newOrder;

    await state.supabase
        .from('restaurants')
        .update({ category_order: newOrder })
        .eq('id', state.restaurantId);

    loadData();
};

window.handleCategoryRename = async (oldName, rawNew) => {
    const newName = rawNew.trim();
    if (!newName || newName === oldName) return;

    // Update items category
    await state.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('restaurant_id', state.restaurantId);

    // Update images
    if (state.currentData.category_images?.[oldName]) {
        const imgs = { ...state.currentData.category_images };
        imgs[newName] = imgs[oldName];
        delete imgs[oldName];
        await state.supabase.from('restaurants').update({ category_images: imgs }).eq('id', state.restaurantId);
    }

    // Update order
    if (state.currentData.category_order?.includes(oldName)) {
        const order = state.currentData.category_order.map(c => c === oldName ? newName : c);
        await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    }

    loadData();
};

window.deleteCategory = async (catName) => {
    if (!confirm(`Apagar a categoria "${catName}" e todos os seus itens?`)) return;

    await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);

    const order = (state.currentData.category_order || []).filter(c => c !== catName);
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);

    loadData();
};

// ─── Items (Pratos) ───
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

    if (isEditing) {
        const { restaurant_id, ...updatePayload } = payload;
        await state.supabase.from('menu_items').update(updatePayload).eq('id', id);
    } else {
        await state.supabase.from('menu_items').insert([payload]);
    }

    window.closeModal('itemModal');
    loadData();
};

// ─── Settings Modal & Tabs ───
window.switchSettingsTab = (tab) => {
    document.querySelectorAll('.settings-tab-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`tab-${tab}`).style.display = 'block';
    document.getElementById(`tab-btn-${tab}`).classList.add('active');

    const titleMap = { design: 'Identidade Visual', general: 'Configurações Gerais', billing: 'A Minha Assinatura' };
    document.getElementById('settingsTitle').textContent = titleMap[tab];
};

window.openSettingsModal = (targetTab = 'design') => {
    const data = state.currentData;
    document.getElementById('modalFont').value = data.font || 'Inter';
    document.getElementById('modalSlug').value = data.slug || '';
    document.getElementById('pdfToggle').checked = data.menu_type === 'pdf';

    window.togglePdfDetails();
    window.switchSettingsTab(targetTab);

    window.closeAllModals();
    document.getElementById('settingsModal').classList.add('open');
};

window.togglePdfDetails = () => {
    const isPdf = document.getElementById('pdfToggle').checked;
    document.getElementById('pdfDetails').style.display = isPdf ? 'block' : 'none';

    const pdfUrl = state.currentData?.pdf_url;
    if (pdfUrl) {
        document.getElementById('pdfUploadState').style.display = 'none';
        document.getElementById('pdfActionsState').style.display = 'flex';
        document.getElementById('pdfViewLink').href = pdfUrl;
    } else {
        document.getElementById('pdfUploadState').style.display = 'flex';
        document.getElementById('pdfActionsState').style.display = 'none';
    }
};

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSettings');
    const orig = btn.textContent;
    btn.innerHTML = '<i class="ph ph-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    const updates = {
        font: document.getElementById('modalFont').value,
        slug: document.getElementById('modalSlug').value.trim().toLowerCase().replace(/\s+/g, '-'),
        menu_type: document.getElementById('pdfToggle').checked ? 'pdf' : 'digital'
    };

    const pdfInput = document.getElementById('pdfUploadInput');
    if (pdfInput.files.length) {
        const { data, error } = await uploadFile(pdfInput.files[0], 'menu-pdf', 'menu-pdfs');
        if (!error && data) updates.pdf_url = data.publicUrl;
    }

    await state.supabase.from('restaurants').update(updates).eq('id', state.restaurantId);

    window.showToast("Configurações atualizadas!", "success");
    setTimeout(() => window.location.reload(), 1000);
};

// ─── Dark Mode Toggle ───
window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';
};
