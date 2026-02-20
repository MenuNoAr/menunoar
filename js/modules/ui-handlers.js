/**
 * ui-handlers.js - Event Handlers and UI Logic
 */
import { state, updateState } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';
import { scrollToSlide, renderMenu } from './render.js';

export function setupInlineEdit(elementId, fieldName) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.classList.add('inline-editable');

    el.addEventListener('blur', async () => {
        const newVal = el.innerText.trim();
        const update = {};
        update[fieldName] = newVal;
        await state.supabase.from('restaurants').update(update).eq('id', state.restaurantId);
        state.currentData[fieldName] = newVal;
    });

    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        }
    });
}

export function initHeaderEditing() {
    setupInlineEdit('restNameEditor', 'name');
    setupInlineEdit('restDescEditor', 'description');
    setupInlineEdit('textWifi', 'wifi_password');
    setupInlineEdit('textPhone', 'phone');
    setupInlineEdit('textAddress', 'address');
}

// Window globally exposed functions for onclick handlers
window.triggerCoverUpload = () => document.getElementById('coverUpload')?.click();

window.handleCoverUpload = async (input) => {
    if (!input.files.length) return;
    const { data, error } = await uploadFile(input.files[0], 'cover');
    if (!error && data) {
        await state.supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', state.restaurantId);
        loadData();
    }
};

window.deleteCover = async () => {
    if (confirm("Remover a capa do restaurante?")) {
        await state.supabase.from('restaurants').update({ cover_url: null }).eq('id', state.restaurantId);
        loadData();
    }
};

window.triggerCatUpload = (cat) => document.getElementById(`upload-${cat.replace(/\s/g, '-')}`)?.click();

window.handleCatUpload = async (catName, input) => {
    if (!input.files.length) return;
    const safeCatName = catName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const { data, error } = await uploadFile(input.files[0], `cat-${safeCatName}`);
    if (!error && data) {
        const newCats = { ...state.currentData.category_images, [catName]: data.publicUrl };
        await state.supabase.from('restaurants').update({ category_images: newCats }).eq('id', state.restaurantId);
        loadData();
    }
};

window.handleCategoryRename = async (oldName, newName) => {
    const val = newName.trim();
    if (!val || val === oldName) return;

    const { error } = await state.supabase.from('menu_items').update({ category: val }).eq('category', oldName).eq('restaurant_id', state.restaurantId);
    if (error) { loadData(); return; }

    if (state.currentData.category_images?.[oldName]) {
        const newImages = { ...state.currentData.category_images };
        newImages[val] = newImages[oldName];
        delete newImages[oldName];
        await state.supabase.from('restaurants').update({ category_images: newImages }).eq('id', state.restaurantId);
    }

    if (state.currentData.category_order?.includes(oldName)) {
        const newOrder = state.currentData.category_order.map(c => c === oldName ? val : c);
        await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);
    }
    loadData();
};

window.deleteCategory = async (catName) => {
    if (confirm(`Tens a certeza que queres apagar a categoria "${catName}" e TODOS os seus pratos?`)) {
        await state.supabase.from('menu_items').delete().eq('category', catName).eq('restaurant_id', state.restaurantId);
        if (state.currentData.category_images?.[catName]) {
            const newImages = { ...state.currentData.category_images };
            delete newImages[catName];
            await state.supabase.from('restaurants').update({ category_images: newImages }).eq('id', state.restaurantId);
        }
        if (state.currentData.category_order?.includes(catName)) {
            const newOrder = state.currentData.category_order.filter(c => c !== catName);
            await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);
        }
        loadData();
    }
};

window.handleItemUpdate = async (id, field, value) => {
    let finalVal = value.trim();
    if (field === 'price') {
        finalVal = parseFloat(finalVal.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (isNaN(finalVal)) { loadData(); return; }
    }
    await state.supabase.from('menu_items').update({ [field]: finalVal }).eq('id', id);
    const item = state.menuItems.find(i => i.id == id);
    if (item) item[field] = finalVal;
    if (field === 'price') loadData();
};

window.toggleAvailability = async (id, currentStatus, btn) => {
    const newStatus = !currentStatus;
    const card = document.getElementById(`item-card-${id}`);
    const item = state.menuItems.find(i => i.id == id);
    if (item) item.available = newStatus;

    if (card) card.classList.toggle('unavailable', !newStatus);
    if (btn) {
        const icon = btn.querySelector('i');
        icon.className = newStatus ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        btn.style.color = newStatus ? 'var(--success)' : '#ccc';
        btn.setAttribute('onclick', `toggleAvailability('${id}', ${newStatus}, this); event.stopPropagation();`);
    }
    await state.supabase.from('menu_items').update({ available: newStatus }).eq('id', id);
};

window.deleteItem = async (id) => {
    if (confirm("Tens a certeza que queres apagar este prato?")) {
        await state.supabase.from('menu_items').delete().eq('id', id);
        loadData();
    }
};

window.addNewCategoryOptimized = async () => {
    let baseName = "Nova Categoria", name = baseName, counter = 1;
    const existingCats = new Set(state.menuItems.map(i => i.category));
    if (state.currentData.category_order) state.currentData.category_order.forEach(c => existingCats.add(c));

    while (existingCats.has(name)) name = `${baseName} ${++counter}`;

    let newOrder = state.currentData.category_order || [];
    if (!newOrder.includes(name)) newOrder.push(name);

    state.currentData.category_order = newOrder;
    renderMenu(state.menuItems);

    setTimeout(() => {
        const track = document.getElementById('editorTrack');
        if (track?.children.length) {
            const lastIdx = track.children.length - 1;
            scrollToSlide(lastIdx, { instant: true });
            setTimeout(() => {
                const editableHeader = track.children[lastIdx].querySelector('.inline-editable');
                if (editableHeader) {
                    editableHeader.focus();
                    const range = document.createRange();
                    range.selectNodeContents(editableHeader);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }, 50);
        }
    }, 10);

    await state.supabase.from('restaurants').update({ category_order: newOrder }).eq('id', state.restaurantId);
};

/* --- IMAGE MODAL LOGIC --- */
let currentImageItemId = null;

window.openImageModal = (id) => {
    currentImageItemId = id;
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;

    const display = document.getElementById('imgPreviewDisplay');
    const placeholder = document.getElementById('imgPreviewPlaceholder');

    if (item.image_url) {
        display.src = item.image_url;
        display.style.display = 'block';
        placeholder.style.display = 'none';
        document.getElementById('btnRemoveImage').style.display = 'inline-flex';
    } else {
        display.style.display = 'none';
        placeholder.style.display = 'block';
        document.getElementById('btnRemoveImage').style.display = 'none';
    }

    window.closeAllModals();
    document.getElementById('imageModal').classList.add('open');
};

document.getElementById('btnChangeImage').onclick = () => document.getElementById('modalImageUpload').click();

document.getElementById('modalImageUpload').onchange = async (e) => {
    if (!e.target.files.length || !currentImageItemId) return;
    const btn = document.getElementById('btnChangeImage');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    await window.handleItemImageUpload(currentImageItemId, e.target);
    btn.innerHTML = original;
    btn.disabled = false;
    window.closeModal('imageModal');
};

window.handleItemImageUpload = async (id, input) => {
    if (!input.files.length) return;
    const { data, error } = await uploadFile(input.files[0], `item-${id}`);
    if (!error && data) {
        await state.supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', id);
        loadData();
    }
};

document.getElementById('btnRemoveImage').onclick = async () => {
    if (!currentImageItemId) return;
    if (confirm("Remover imagem deste prato?")) {
        await state.supabase.from('menu_items').update({ image_url: null }).eq('id', currentImageItemId);
        window.closeModal('imageModal');
        loadData();
    }
};

/* --- QR CODE --- */
let qrCode = null;
window.openQrModal = () => {
    const modal = document.getElementById('qrModal');
    if (modal.classList.contains('open')) { window.closeModal('qrModal'); return; }
    window.closeAllModals();
    modal.classList.add('open');

    const url = `${window.location.origin}/menu.html?id=${state.currentData.slug}`;
    if (!qrCode) {
        if (typeof QRCodeStyling === 'undefined') return;
        qrCode = new QRCodeStyling({
            width: 300, height: 300, type: "svg", data: url, image: "assets/images/logo.svg",
            dotsOptions: { color: "#00B2FF", type: "rounded" },
            backgroundOptions: { color: "#ffffff" },
            imageOptions: { crossOrigin: "anonymous", margin: 10 }
        });
        qrCode.append(document.getElementById('qr-code-container'));
    } else {
        qrCode.update({ data: url });
    }
};

window.downloadQr = () => qrCode?.download({ name: `menu-${state.currentData.slug}-qr`, extension: "png" });

/* --- SETTINGS --- */
window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    if (modal.classList.contains('open')) { window.closeModal('settingsModal'); return; }

    document.getElementById('modalSlug').value = state.currentData.slug || '';
    document.getElementById('modalFont').value = state.currentData.font || 'Inter';
    document.getElementById('pdfToggle').checked = state.currentData.menu_type === 'pdf';
    window.togglePdfDetails();

    const planText = document.getElementById('currentPlanText');
    if (planText) {
        const status = state.currentData.subscription_status;
        if (!!state.currentData.stripe_customer_id && (status === 'active' || status === 'trialing')) {
            planText.textContent = "Profissional (Membro Premium)";
            planText.style.color = "#16a34a";
        } else if (status === 'trialing') {
            const daysLeft = Math.ceil((new Date(state.currentData.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
            planText.textContent = daysLeft > 0 ? `Teste Grátis (${daysLeft} dias restantes)` : "Teste Expirado";
            planText.style.color = daysLeft > 0 ? "#16a34a" : "#ef4444";
        } else {
            planText.textContent = status === 'active' ? "Profissional (Ativo)" : "Sem Plano Ativo";
            planText.style.color = status === 'active' ? "#16a34a" : "#6b7280";
        }
    }
    window.closeAllModals();
    modal.classList.add('open');
};

window.togglePdfDetails = () => {
    const isPdf = document.getElementById('pdfToggle').checked;
    document.getElementById('pdfDetails').style.display = isPdf ? 'block' : 'none';
};

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const isPdf = document.getElementById('pdfToggle').checked;
    const updates = {
        slug: document.getElementById('modalSlug').value,
        font: document.getElementById('modalFont').value,
        menu_type: isPdf ? 'pdf' : 'digital'
    };
    const pdfInput = document.getElementById('pdfUploadInput');
    if (pdfInput.files.length > 0) {
        const { data, error } = await uploadFile(pdfInput.files[0], 'menu-pdf', 'menu-pdfs');
        if (!error && data) updates.pdf_url = data.publicUrl;
    }
    await state.supabase.from('restaurants').update(updates).eq('id', state.restaurantId);
    alert("Configurações guardadas!");
    window.closeModal('settingsModal');
    loadData();
};

/* --- ITEM MODAL --- */
window.openAddItemModal = (prefillCat = '') => {
    ['editItemName', 'editItemPrice', 'editItemDesc', 'editItemId'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('editItemCat').value = prefillCat;
    document.getElementById('modalTitle').textContent = "Adicionar Prato";
    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
};

window.openEditItemModal = (id) => {
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemCat').value = item.category;
    document.getElementById('editItemId').value = item.id;
    document.getElementById('modalTitle').textContent = "Editar Prato";
    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
};

document.getElementById('itemEditForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const payload = {
        restaurant_id: state.restaurantId,
        name: document.getElementById('editItemName').value,
        price: parseFloat(document.getElementById('editItemPrice').value),
        description: document.getElementById('editItemDesc').value,
        category: document.getElementById('editItemCat').value,
        available: true
    };
    if (id) {
        delete payload.restaurant_id; delete payload.available;
        await state.supabase.from('menu_items').update(payload).eq('id', id);
    } else {
        await state.supabase.from('menu_items').insert([payload]);
    }
    window.closeModal('itemModal');
    loadData();
};
