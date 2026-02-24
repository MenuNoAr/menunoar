/**
 * ui-handlers.js - Event Handlers & UI Logic
 * Optimizations: debounced inline edits, guard clauses, optimistic UI for
 * toggleAvailability, consolidated modal helpers.
 */
import { state, updateState } from './state.js';
import { loadData } from './api.js';
import { uploadFile } from '../upload-service.js';
import { scrollToSlide, renderMenu } from './render.js';

// ─── Inline Editing ───────────────────────────────────────────────────────────
export function setupInlineEdit(elementId, fieldName) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.classList.add('inline-editable');

    el.addEventListener('blur', async () => {
        const newVal = el.innerText.trim();
        if (newVal === state.currentData[fieldName]) return; // no change
        await state.supabase
            .from('restaurants')
            .update({ [fieldName]: newVal })
            .eq('id', state.restaurantId);
        state.currentData[fieldName] = newVal;

        if (fieldName === 'name') window.checkTutorialStep('edit_name');
    });

    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
}

export function initHeaderEditing() {
    ['restNameEditor', 'restDescEditor', 'textWifi', 'textPhone', 'textAddress'].forEach((id, i) => {
        const fields = ['name', 'description', 'wifi_password', 'phone', 'address'];
        setupInlineEdit(id, fields[i]);
    });
}

// ─── Cover Image ──────────────────────────────────────────────────────────────
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

window.deleteCover = async () => {
    if (!confirm('Remover a capa do restaurante?')) return;
    await state.supabase
        .from('restaurants')
        .update({ cover_url: null })
        .eq('id', state.restaurantId);
    loadData();
};

// ─── Category Images ──────────────────────────────────────────────────────────
window.triggerCatUpload = (cat) =>
    document.getElementById(`upload-${cat.replace(/\s+/g, '-')}`)?.click();

window.handleCatUpload = async (catName, input) => {
    if (!input.files.length) return;
    const key = catName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const { data, error } = await uploadFile(input.files[0], `cat-${key}`);
    if (!error && data) {
        const newCats = { ...state.currentData.category_images, [catName]: data.publicUrl };
        await state.supabase
            .from('restaurants')
            .update({ category_images: newCats })
            .eq('id', state.restaurantId);
        loadData();
    }
};

// ─── Category Rename ──────────────────────────────────────────────────────────
window.handleCategoryRename = async (oldName, rawNew) => {
    const newName = rawNew.trim();
    if (!newName || newName === oldName) return;

    const { error } = await state.supabase
        .from('menu_items')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('restaurant_id', state.restaurantId);

    if (error) { loadData(); return; }

    // Update category_images key
    if (state.currentData.category_images?.[oldName]) {
        const imgs = { ...state.currentData.category_images };
        imgs[newName] = imgs[oldName];
        delete imgs[oldName];
        await state.supabase
            .from('restaurants')
            .update({ category_images: imgs })
            .eq('id', state.restaurantId);
    }

    // Update category_order
    if (state.currentData.category_order?.includes(oldName)) {
        const order = state.currentData.category_order.map(c => c === oldName ? newName : c);
        await state.supabase
            .from('restaurants')
            .update({ category_order: order })
            .eq('id', state.restaurantId);
    }

    loadData();
};

// ─── Category Delete ──────────────────────────────────────────────────────────
window.deleteCategory = async (catName) => {
    if (!confirm(`Tens a certeza que queres apagar a categoria "${catName}" e TODOS os seus pratos?`)) return;

    await state.supabase
        .from('menu_items')
        .delete()
        .eq('category', catName)
        .eq('restaurant_id', state.restaurantId);

    const updates = {};

    if (state.currentData.category_images?.[catName]) {
        const imgs = { ...state.currentData.category_images };
        delete imgs[catName];
        updates.category_images = imgs;
    }

    if (state.currentData.category_order?.includes(catName)) {
        updates.category_order = state.currentData.category_order.filter(c => c !== catName);
    }

    if (Object.keys(updates).length) {
        await state.supabase
            .from('restaurants')
            .update(updates)
            .eq('id', state.restaurantId);
    }

    loadData();
};

// ─── Item Inline Update ───────────────────────────────────────────────────────
window.handleItemUpdate = async (id, field, rawValue) => {
    let value = rawValue.trim();
    if (field === 'price') {
        value = parseFloat(value.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (isNaN(value)) { loadData(); return; }
    }
    await state.supabase.from('menu_items').update({ [field]: value }).eq('id', id);
    const item = state.menuItems.find(i => i.id == id);
    if (item) item[field] = value;
    if (field === 'price') loadData(); // re-render formatted price
};

// ─── Toggle Availability (optimistic UI) ─────────────────────────────────────
window.toggleAvailability = async (id, currentStatus, btn) => {
    const newStatus = !currentStatus;

    // Optimistic update
    const card = document.getElementById(`item-card-${id}`);
    card?.classList.toggle('unavailable', !newStatus);
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.className = newStatus ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        btn.style.color = newStatus ? 'var(--success)' : '#ccc';
        btn.setAttribute('onclick', `toggleAvailability('${id}', ${newStatus}, this); event.stopPropagation();`);
    }

    const item = state.menuItems.find(i => i.id == id);
    if (item) item.available = newStatus;

    await state.supabase.from('menu_items').update({ available: newStatus }).eq('id', id);
};

// ─── Delete Item ──────────────────────────────────────────────────────────────
window.deleteItem = async (id) => {
    if (!confirm('Tens a certeza que queres apagar este prato?')) return;
    await state.supabase.from('menu_items').delete().eq('id', id);
    loadData();
};

// ─── Add New Category ─────────────────────────────────────────────────────────
window.addNewCategoryOptimized = async () => {
    const existing = new Set([
        ...state.menuItems.map(i => i.category),
        ...(state.currentData.category_order || []),
    ]);

    let name = 'Nova Categoria', counter = 1;
    while (existing.has(name)) name = `Nova Categoria ${++counter}`;

    const newOrder = [...(state.currentData.category_order || []), name];
    state.currentData.category_order = newOrder;
    renderMenu(state.menuItems);

    window.checkTutorialStep('create_cat');

    // Scroll to + focus new tab's editable title
    requestAnimationFrame(() => {
        const track = document.getElementById('editorTrack');
        if (!track?.children.length) return;
        const lastIdx = track.children.length - 1;
        scrollToSlide(lastIdx, { instant: true });
        setTimeout(() => {
            const editable = track.children[lastIdx]?.querySelector('.inline-editable');
            if (!editable) return;
            editable.focus();
            const range = document.createRange();
            range.selectNodeContents(editable);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 60);
    });

    await state.supabase
        .from('restaurants')
        .update({ category_order: newOrder })
        .eq('id', state.restaurantId);
};

// ─── Image Modal ──────────────────────────────────────────────────────────────
let _currentImageItemId = null;

window.openImageModal = (id) => {
    _currentImageItemId = id;
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;

    const display = document.getElementById('imgPreviewDisplay');
    const placeholder = document.getElementById('imgPreviewPlaceholder');
    const removeBtn = document.getElementById('btnRemoveImage');

    if (item.image_url) {
        display.src = item.image_url;
        display.style.display = 'block';
        placeholder.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
        display.style.display = 'none';
        placeholder.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
    }

    window.closeAllModals();
    document.getElementById('imageModal').classList.add('open');
};

document.getElementById('btnChangeImage').onclick = () =>
    document.getElementById('modalImageUpload').click();

document.getElementById('modalImageUpload').onchange = async (e) => {
    if (!e.target.files.length || !_currentImageItemId) return;
    const btn = document.getElementById('btnChangeImage');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    await window.handleItemImageUpload(_currentImageItemId, e.target);
    btn.innerHTML = orig;
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
    if (!_currentImageItemId || !confirm('Remover imagem deste prato?')) return;
    await state.supabase.from('menu_items').update({ image_url: null }).eq('id', _currentImageItemId);
    window.closeModal('imageModal');
    loadData();
};

// ─── QR Code Modal ────────────────────────────────────────────────────────────
const QR_DEFAULT_LOGO = 'assets/images/logo.svg';
let _qrCode = null;
let _qrLogoUrl = QR_DEFAULT_LOGO; // tracks current logo (default or custom Data URL)

window.openQrModal = () => {
    const modal = document.getElementById('qrModal');
    if (modal.classList.contains('open')) { window.closeModal('qrModal'); return; }
    window.closeAllModals();
    modal.classList.add('open');
    const nameEl = document.getElementById('qrRestaurantName');
    if (nameEl) nameEl.textContent = state.currentData.name;
    _renderQr();
};

function _renderQr() {
    const url = `https://menunoar.pt/menu.html?id=${state.currentData.slug}`;
    const opts = {
        width: 280, height: 280, type: 'svg', data: url,
        image: _qrLogoUrl,
        dotsOptions: { color: '#00B2FF', type: 'rounded' },
        backgroundOptions: { color: '#ffffff' },
        imageOptions: { crossOrigin: 'anonymous', margin: 8 },
    };

    const container = document.getElementById('qr-code-container');
    if (!container) return;

    if (!_qrCode) {
        if (typeof QRCodeStyling === 'undefined') return;
        _qrCode = new QRCodeStyling(opts);
        _qrCode.append(container);
    } else {
        _qrCode.update(opts);
    }
}

/** Called when user picks a new logo file */
window.handleQrLogoChange = (input) => {
    if (!input.files.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        _qrLogoUrl = e.target.result; // Data URL
        // Update preview image
        const img = document.getElementById('qrLogoImg');
        if (img) img.src = _qrLogoUrl;
        // Show "repor padrão" button
        const resetBtn = document.getElementById('btnResetQrLogo');
        if (resetBtn) resetBtn.style.display = 'inline-flex';
        // Re-render QR with new logo
        _renderQr();
    };
    reader.readAsDataURL(file);
    // Clear input so same file can be re-selected
    input.value = '';
};

/** Revert logo back to the MenuNoAr default */
window.resetQrLogo = () => {
    _qrLogoUrl = QR_DEFAULT_LOGO;
    const img = document.getElementById('qrLogoImg');
    if (img) img.src = QR_DEFAULT_LOGO;
    const resetBtn = document.getElementById('btnResetQrLogo');
    if (resetBtn) resetBtn.style.display = 'none';
    _renderQr();
};

window.downloadQr = () =>
    _qrCode?.download({ name: `menu-${state.currentData.slug}-qr`, extension: 'png' });

// ─── Settings Modal ───────────────────────────────────────────────────────────
window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    if (modal.classList.contains('open')) { window.closeModal('settingsModal'); return; }

    document.getElementById('modalSlug').value = state.currentData.slug || '';
    const fontSelect = document.getElementById('modalFont');
    fontSelect.value = state.currentData.font || 'Inter';
    fontSelect.style.fontFamily = fontSelect.options[fontSelect.selectedIndex]?.style.fontFamily || 'Inter, sans-serif';
    document.getElementById('pdfToggle').checked = state.currentData.menu_type === 'pdf';
    window.togglePdfDetails();

    // Plan label and Upgrade Button
    const planText = document.getElementById('currentPlanText');
    const upgradeBtn = document.querySelector('.edit-modal-content a[href="subscription.html"]');

    if (planText) {
        const { subscription_status: status, stripe_customer_id: cid, trial_ends_at } = state.currentData;
        const isActiveOrPaid = cid && (status === 'active' || status === 'trialing');

        if (isActiveOrPaid) {
            planText.textContent = 'Profissional (Membro Premium)';
            planText.style.color = '#16a34a';
            if (upgradeBtn) upgradeBtn.innerHTML = '<i class="fa-solid fa-gear"></i> Gerir';
        } else if (status === 'trialing') {
            const days = Math.ceil((new Date(trial_ends_at) - Date.now()) / 86_400_000);
            planText.textContent = days > 0 ? `Teste Grátis (${days} dias restantes)` : 'Teste Expirado';
            planText.style.color = days > 0 ? '#16a34a' : '#ef4444';
            if (upgradeBtn) upgradeBtn.innerHTML = '<i class="fa-solid fa-crown"></i> Upgrade';
        } else {
            planText.textContent = status === 'active' ? 'Profissional (Ativo)' : 'Sem Plano Ativo';
            planText.style.color = status === 'active' ? '#16a34a' : '#6b7280';
            if (upgradeBtn) upgradeBtn.innerHTML = '<i class="fa-solid fa-crown"></i> Upgrade';
        }
    }

    window.closeAllModals();
    modal.classList.add('open');
    window.checkTutorialStep('settings_open');
};

window.togglePdfDetails = () => {
    const isPdf = document.getElementById('pdfToggle').checked;
    document.getElementById('pdfDetails').style.display = isPdf ? 'block' : 'none';

    // Show existing PDF block if applicable
    const pdfUrl = state.currentData?.pdf_url;
    if (pdfUrl) {
        document.getElementById('pdfUploadState').style.display = 'none';
        document.getElementById('pdfActionsState').style.display = 'block';

        let filename = 'menu.pdf';
        try {
            const parts = new URL(pdfUrl).pathname.split('/');
            filename = parts[parts.length - 1] || 'menu.pdf';
        } catch (e) { }
        document.getElementById('pdfCurrentFileName').textContent = filename;
        document.getElementById('pdfViewLink').href = pdfUrl;
    } else {
        document.getElementById('pdfUploadState').style.display = 'block';
        document.getElementById('pdfActionsState').style.display = 'none';
    }
};

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.querySelector('#settingsForm .btn-confirm');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';

    let isPdf = document.getElementById('pdfToggle').checked;

    const updates = {
        font: document.getElementById('modalFont').value,
        menu_type: isPdf ? 'pdf' : 'digital',
    };

    const pdfInput = document.getElementById('pdfUploadInput');
    let hasPdfUrl = state.currentData?.pdf_url ? true : false;

    if (pdfInput.files.length) {
        const { data, error } = await uploadFile(pdfInput.files[0], 'menu-pdf', 'menu-pdfs');
        if (!error && data) {
            updates.pdf_url = data.publicUrl;
            hasPdfUrl = true;
        }
    }

    // Failsafe: if the user turns on PDF mode but there is no PDF file loaded, revert to digital
    if (isPdf && !hasPdfUrl) {
        updates.menu_type = 'digital';
        document.getElementById('pdfToggle').checked = false;
    }

    await state.supabase.from('restaurants').update(updates).eq('id', state.restaurantId);

    if (btn) btn.innerHTML = 'Guardar Configurações';
    window.closeModal('settingsModal');
    window.checkTutorialStep('settings');

    // Determine if we need to reload or just update data
    // Because switching to/from PDF destroys the DOM structure of .editor-canvas, it's safer to always physically reload
    if (window.showToast) {
        window.showToast('Configurações guardadas com sucesso!', 'success');
        setTimeout(() => window.location.reload(), 800);
    } else {
        window.location.reload();
    }
};

window.deletePdfFile = async () => {
    if (!confirm('Tem a certeza que deseja remover o PDF do menu? Terá de carregar outro PDF ou desativar o modo PDF para ter um menu online.')) return;

    await state.supabase.from('restaurants').update({ pdf_url: null }).eq('id', state.restaurantId);
    state.currentData.pdf_url = null;

    document.getElementById('pdfUploadInput').value = '';
    const display = document.getElementById('pdfFileNameDisplay');
    if (display) display.textContent = 'Clique para selecionar o PDF';

    window.togglePdfDetails();
};

window.promptDeleteRestaurant = async () => {
    const restName = state.currentData.name;
    const input = prompt(`Atenção! Esta ação é irreversível. Isto vai apagar o teu restaurante e todo o teu menu.\n\nPara confirmar, por favor escreve o nome exato:\n"${restName}"`);

    if (input === null) return; // user cancelled
    if (input.trim() !== restName) {
        if (window.showToast) window.showToast('Nome incorreto. O menu não foi apagado.', 'error');
        else alert('Nome incorreto. Operação cancelada.');
        return;
    }

    try {
        const { error } = await state.supabase.from('restaurants').delete().eq('id', state.restaurantId);
        if (error) throw error;

        if (window.showToast) window.showToast('O menu foi apagado com sucesso.', 'success');
        setTimeout(() => {
            if (typeof signOut === 'function') {
                signOut();
            } else {
                window.location.href = 'index.html';
            }
        }, 1500);
    } catch (e) {
        console.error('Error deleting menu:', e);
        if (window.showToast) window.showToast('Erro ao apagar o menu. Tenta novamente.', 'error');
        else alert('Erro ao apagar o menu.');
    }
};

// ─── Item Modal ───────────────────────────────────────────────────────────────
window.openAddItemModal = (prefillCat = '') => {
    ['editItemName', 'editItemPrice', 'editItemDesc', 'editItemId']
        .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('editItemCat').value = prefillCat;
    document.getElementById('modalTitle').textContent = 'Adicionar Prato';
    window.closeAllModals();
    document.getElementById('itemModal').classList.add('open');
    window.checkTutorialStep('add_item_open');
};

window.openEditItemModal = (id) => {
    const item = state.menuItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemCat').value = item.category;
    document.getElementById('editItemId').value = item.id;
    document.getElementById('modalTitle').textContent = 'Editar Prato';
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
        available: true,
    };

    if (id) {
        // Update: strip insert-only fields
        const { restaurant_id, available, ...updatePayload } = payload;
        await state.supabase.from('menu_items').update(updatePayload).eq('id', id);
    } else {
        await state.supabase.from('menu_items').insert([payload]);
    }

    window.closeModal('itemModal');
    window.checkTutorialStep('add_item');
    loadData();
};
