/**
 * render.js - UI Generation and Rendering
 */
import { state, updateState } from './state.js';
import { saveCategoryOrder, loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

const escapeHTML = (str) => {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
};

export function updateLiveLink(slug) {
    const url = `${window.location.origin}/menu.html?id=${slug}`;
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(url, '_blank');
    const link = document.getElementById('liveLink');
    if (link) link.href = url;
}

export function renderHeader(data) {
    document.getElementById('restNameEditor').textContent = data.name || "Nome do Restaurante";
    document.getElementById('restDescEditor').textContent = data.description || "Descrição curta (clica para editar)";

    const coverDiv = document.getElementById('coverEditor');
    if (coverDiv) {
        if (data.cover_url) {
            coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
            coverDiv.style.height = '350px';
            coverDiv.innerHTML = `
                <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
                <div class="header-actions-abs">
                    <button class="action-btn btn-delete" onclick="deleteCover(); event.stopPropagation();" title="Remover Capa"><i class="fa-solid fa-trash"></i></button>
                </div>
                <input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">
            `;
        } else {
            coverDiv.style.backgroundImage = 'none';
            coverDiv.style.backgroundColor = 'var(--bg-page)';
            coverDiv.style.height = '120px';
            coverDiv.innerHTML = `<div class="edit-overlay"><i class="fa-solid fa-camera"></i> Adicionar Capa</div><input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">`;
        }
    }

    updateBadge('badgeWifi', 'textWifi', data.wifi_password);
    updateBadge('badgePhone', 'textPhone', data.phone);
    updateBadge('badgeAddress', 'textAddress', data.address);
}

function updateBadge(badgeId, textId, value) {
    const el = document.getElementById(badgeId);
    const span = document.getElementById(textId);
    if (!el || !span) return;
    span.textContent = value || "Adicionar...";
    el.style.opacity = value ? '1' : '0.5';
}

export function renderMenu(items) {
    const container = document.getElementById('menuContainer');
    const nav = document.getElementById('categoryNav');
    if (!container || !nav) return;

    // Use DocumentFragment for batch nav updates
    const navFragment = document.createDocumentFragment();

    // Track setup
    container.innerHTML = '<div id="editorTrack" class="slider-track"></div>';
    const track = document.getElementById('editorTrack');

    nav.className = 'category-tabs sticky-nav';

    const uniqueCatsSet = new Set(items.map(i => i.category));
    if (state.currentData.category_order) state.currentData.category_order.forEach(c => uniqueCatsSet.add(c));

    let uniqueCats = Array.from(uniqueCatsSet);
    if (state.currentData.category_order) {
        const order = state.currentData.category_order;
        uniqueCats.sort((a, b) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)));
    }

    const groups = uniqueCats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    uniqueCats.forEach((cat, index) => {
        // Build Nav Tabs
        const btn = document.createElement('div');
        btn.className = `tab-btn draggable-tab ${(!state.activeCategoryName && index === 0) || (cat === state.activeCategoryName) ? 'active' : ''}`;
        btn.dataset.category = cat;
        btn.dataset.index = index;
        btn.onclick = () => scrollToSlide(index);

        if (!state.activeCategoryName && index === 0) updateState({ activeCategoryName: cat });

        btn.innerHTML = `
            <span>${escapeHTML(cat)}</span>
            <div class="handle"><i class="fa-solid fa-grip-lines-vertical"></i></div>
        `;
        navFragment.appendChild(btn);

        // Build Slides
        const section = document.createElement('div');
        section.id = `sec-${cat.replace(/\s/g, '-')}`;
        section.className = 'menu-slide';
        section.style.minWidth = '100%';

        const catImages = state.currentData.category_images || {};
        const safeCat = cat.replace(/\s/g, '-');

        let headerHTML = catImages[cat]
            ? `<div class="cat-banner editable-trigger" onclick="triggerCatUpload('${cat}')">
                <img src="${catImages[cat]}" loading="lazy">
                <div class="cat-banner-overlay">
                    <h2 contenteditable="true" spellcheck="false" class="inline-editable" onclick="event.stopPropagation();" onblur="handleCategoryRename('${cat}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${escapeHTML(cat)}</h2>
                </div>
                <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
                <div class="header-actions">
                    <button class="action-btn btn-delete" onclick="deleteCategory('${cat}'); event.stopPropagation();" title="Apagar Categoria"><i class="fa-solid fa-trash"></i></button>
                </div>
                <input type="file" id="upload-${safeCat}" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*">
            </div>`
            : `<div class="slide-title">
                <span contenteditable="true" spellcheck="false" class="text-editable inline-editable" onblur="handleCategoryRename('${cat}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${escapeHTML(cat)}</span>
                <div class="cat-actions-minimal">
                     <label class="custom-file-upload"><i class="fa-solid fa-image"></i> Imagem<input type="file" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*"></label>
                    <button class="action-btn btn-delete" onclick="deleteCategory('${cat}')" title="Apagar Categoria"><i class="fa-solid fa-trash"></i></button>
                </div>
             </div>`;

        const itemsHTML = groups[cat].map(item => createItemCard(item)).join('');
        const addItemBtn = `<div class="add-item-btn" onclick="openAddItemModal('${cat}')"><span><i class="fa-solid fa-plus"></i> Adicionar Prato em "${escapeHTML(cat)}"</span></div>`;

        section.innerHTML = headerHTML + `<div class="items-grid">${itemsHTML}</div>` + addItemBtn;
        track.appendChild(section);
    });

    // Final Tab actions
    const addCatBtn = document.createElement('button');
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = () => window.addNewCategoryOptimized();
    addCatBtn.innerHTML = '<i class="fa-solid fa-plus"></i> <span>Nova Categoria</span>';
    navFragment.appendChild(addCatBtn);

    nav.innerHTML = '';
    nav.appendChild(navFragment);

    if (state.activeCategoryName) {
        const newIdx = uniqueCats.indexOf(state.activeCategoryName);
        if (newIdx !== -1) updateState({ currentSlideIndex: newIdx });
    }

    // Defer costly operations
    requestAnimationFrame(() => {
        scrollToSlide(state.currentSlideIndex, { instant: true });
        if (window.Sortable) {
            if (state.sortableInstance) state.sortableInstance.destroy();
            updateState({
                sortableInstance: new Sortable(nav, {
                    animation: 150, handle: '.handle', draggable: '.draggable-tab', ghostClass: 'sortable-ghost',
                    onEnd: async function () {
                        const newOrder = Array.from(nav.querySelectorAll('.draggable-tab')).map(tab => tab.dataset.category);
                        await saveCategoryOrder(newOrder);
                        const newIndex = Array.from(nav.querySelectorAll('.tab-btn')).findIndex(btn => btn.classList.contains('active'));
                        if (newIndex !== -1) updateState({ currentSlideIndex: newIndex });
                    }
                })
            });
        }
    });
}

export function scrollToSlide(index, options = {}) {
    const track = document.getElementById('editorTrack');
    if (!track || !track.children.length) return;

    index = Math.max(0, Math.min(index, track.children.length - 1));
    updateState({ currentSlideIndex: index });

    track.style.transition = options.instant ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    track.style.transform = `translateX(-${index * 100}%)`;

    if (options.instant) track.offsetHeight; // Force reflow

    // Update Tab Classes
    const tabs = document.querySelectorAll('.draggable-tab');
    tabs.forEach((t, i) => {
        const isActive = i === index;
        t.classList.toggle('active', isActive);
        if (isActive) updateState({ activeCategoryName: t.dataset.category });
    });

    // Adjust Height
    const container = document.getElementById('menuContainer');
    const currentSlide = track.children[index];
    if (currentSlide && container) {
        container.style.height = `${currentSlide.offsetHeight}px`;
        if (state.slideObserver) state.slideObserver.disconnect();
        const obs = new ResizeObserver(entries => {
            container.style.height = `${entries[0].target.offsetHeight}px`;
        });
        obs.observe(currentSlide);
        updateState({ slideObserver: obs });
    }
}

export function createItemCard(item) {
    const { id, name, description, price, available: isAvail, image_url } = item;
    const eyeIcon = isAvail ? 'fa-eye' : 'fa-eye-slash';

    return `
        <div id="item-card-${id}" class="menu-item ${!isAvail ? 'unavailable' : ''} editable-container">
            <div class="item-text">
                <h3 contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${id}', 'name', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${escapeHTML(name)}</h3>
                <p contenteditable="true" spellcheck="false" class="item-desc inline-editable" onblur="handleItemUpdate('${id}', 'description', this.innerText)">${escapeHTML(description)}</p>
                <div class="item-footer">
                    <div class="item-price">
                        <span contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${id}', 'price', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${Number(price).toFixed(2)}</span>€
                    </div>
                    <div class="item-controls">
                        <button class="btn-eye-toggle" onclick="toggleAvailability('${id}', ${isAvail}, this); event.stopPropagation();" title="Visibilidade" style="color: ${isAvail ? 'var(--success)' : '#ccc'}">
                            <i class="fa-solid ${eyeIcon}"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteItem('${id}'); event.stopPropagation();" title="Apagar Prato">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="item-img" onclick="openImageModal('${id}')">
                ${image_url ? `<img src="${image_url}" loading="lazy">` : `<div class="img-placeholder"><i class="fa-solid fa-image"></i></div>`}
            </div>
        </div>
    `;
}
