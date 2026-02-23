/**
 * render.js - UI Rendering
 * Optimizations: DocumentFragment, escapeHTML (XSS protection), lazy img loading,
 * requestAnimationFrame for Sortable init, cleaner scrollToSlide.
 */
import { state, updateState } from './state.js';
import { saveCategoryOrder } from './api.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

// ─── Live Link ────────────────────────────────────────────────────────────────
// ─── Live Link ────────────────────────────────────────────────────────────────
export function updateLiveLink(slug) {
    const url = `https://menunoar.pt/menu.html?id=${slug}`;

    // Update both desktop and mobile buttons
    ['liveLinkBtn', 'liveLinkBtnMobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = () => window.open(url, '_blank');
    });

    const link = document.getElementById('liveLink');
    if (link) link.href = url;
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function renderHeader(data) {
    const nameEl = document.getElementById('restNameEditor');
    const descEl = document.getElementById('restDescEditor');
    if (nameEl) nameEl.textContent = data.name || 'Nome do Restaurante';
    if (descEl) descEl.textContent = data.description || 'Descrição curta (clica para editar)';

    const coverDiv = document.getElementById('coverEditor');
    if (coverDiv) {
        if (data.cover_url) {
            coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
            coverDiv.style.height = '350px';
            coverDiv.innerHTML = `
                <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
                <div class="header-actions-abs">
                    <button class="action-btn btn-delete" onclick="deleteCover(); event.stopPropagation();" title="Remover Capa">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">
            `;
        } else {
            coverDiv.style.backgroundImage = 'none';
            // Placeholder Styling (Original style via edit-overlay)
            coverDiv.style.background = 'var(--bg-page)';
            coverDiv.style.border = 'none';
            coverDiv.style.borderRadius = '0';
            coverDiv.style.height = '120px';
            coverDiv.style.display = 'block';
            coverDiv.style.margin = '0';
            coverDiv.innerHTML = `
                <div class="edit-overlay" style="opacity: 1; border-radius: 0;">
                    <i class="fa-solid fa-camera" style="margin-right:8px;"></i> Adicionar Capa
                </div>
                <input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">
            `;
        }
    }

    _updateBadge('badgeWifi', 'textWifi', data.wifi_password);
    _updateBadge('badgePhone', 'textPhone', data.phone);
    _updateBadge('badgeAddress', 'textAddress', data.address);
}

function _updateBadge(badgeId, textId, value) {
    const el = document.getElementById(badgeId);
    const span = document.getElementById(textId);
    if (!el || !span) return;
    span.textContent = value || 'Adicionar...';
    el.style.opacity = value ? '1' : '0.5';
}

// ─── PDF Viewer ───────────────────────────────────────────────────────────────
export function renderPdfViewer(data) {
    const canvas = document.querySelector('.editor-canvas');
    if (!canvas) return;

    // Clear and set height
    canvas.innerHTML = '';
    // Use an exact positioning that anchors to viewport, preventing scroll
    canvas.style.position = 'fixed';
    canvas.style.top = 'var(--navbar-height)';
    canvas.style.bottom = '0';
    canvas.style.left = '0';
    canvas.style.right = '0';
    canvas.style.margin = '0';
    canvas.style.padding = '0';
    canvas.style.border = 'none';
    canvas.style.width = '100vw';
    canvas.style.maxWidth = '100vw';
    canvas.style.height = 'calc(100vh - var(--navbar-height))';
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.background = '#ffffff'; // Paint sides of the screen white
    canvas.style.overflow = 'hidden';

    // Kill the outer page scroll so the only scroll is inside the PDF
    document.body.style.overflow = 'hidden';

    // Hide the Tutorial / Help Button in PDF mode
    const tutBtn = document.querySelector('[onclick="openTutorial()"]');
    if (tutBtn) tutBtn.style.display = 'none';

    if (!data.pdf_url) {
        canvas.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 20px;">
                <i class="fa-solid fa-file-pdf" style="font-size: 4rem; color: var(--text-muted); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 10px;">Nenhum PDF carregado</h3>
                <p style="color: var(--text-muted); margin-bottom: 20px;">Vai às configurações (<i class="fa-solid fa-gear"></i>) para fazer upload do teu PDF.</p>
                <button onclick="openSettingsModal()" class="btn-confirm"><i class="fa-solid fa-gear"></i> Abrir Configurações</button>
            </div>
        `;
        return;
    }

    // Embed the PDF as cleanly as possible.
    // The iframe adopts the max-width, sitting perfectly centered in the white canvas.
    // #view=Fit guarantees the whole PDF scales to fit inside the given height/width with no scroll!
    canvas.innerHTML = `
        <div id="pdfLoading" style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#ffffff; z-index:10;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
            <p style="color: var(--text-muted); font-weight: 500;">A carregar visualizador PDF...</p>
        </div>
        <iframe src="${data.pdf_url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit" 
            style="flex:1; width:100%; max-width:900px; margin: 0 auto; height:100%; border:none; background: #ffffff; opacity: 0; transition: opacity 0.3s; display:block; box-sizing: border-box;" 
            allowfullscreen 
            onload="document.getElementById('pdfLoading').style.display='none'; this.style.opacity='1';">
        </iframe>
    `;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export function renderMenu(items) {
    const container = document.getElementById('menuContainer');
    const nav = document.getElementById('categoryNav');
    if (!container || !nav) return;

    // Reset track
    container.innerHTML = '<div id="editorTrack" class="slider-track"></div>';
    const track = document.getElementById('editorTrack');
    nav.className = 'category-tabs sticky-nav';

    // Build ordered category list
    const catSet = new Set(items.map(i => i.category));
    (state.currentData.category_order || []).forEach(c => catSet.add(c));
    let cats = Array.from(catSet);

    if (state.currentData.category_order?.length) {
        const order = state.currentData.category_order;
        cats.sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
        });
    }

    // Group items by category (single pass)
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    // Build nav + slides via DocumentFragment (batch DOM insertion)
    const navFrag = document.createDocumentFragment();

    cats.forEach((cat, index) => {
        // ── Nav tab ──
        const tab = document.createElement('div');
        const isActive = state.activeCategoryName
            ? cat === state.activeCategoryName
            : index === 0;

        if (isActive && !state.activeCategoryName) updateState({ activeCategoryName: cat });

        tab.className = `tab-btn draggable-tab${isActive ? ' active' : ''}`;
        tab.dataset.category = cat;
        tab.dataset.index = index;
        tab.onclick = () => scrollToSlide(index);
        tab.innerHTML = `
            <span>${escapeHTML(cat)}</span>
            <div class="handle" title="Arrastar">
                <i class="fa-solid fa-grip-lines-vertical"></i>
            </div>
        `;
        navFrag.appendChild(tab);

        // ── Slide section ──
        const section = document.createElement('div');
        section.id = `sec-${cat.replace(/\s+/g, '-')}`;
        section.className = 'menu-slide';
        section.style.minWidth = '100%';

        const catImg = (state.currentData.category_images || {})[cat];
        const safeCat = cat.replace(/\s+/g, '-');

        const headerHTML = catImg
            ? `<div class="cat-banner editable-trigger" onclick="triggerCatUpload('${cat}')">
                <img src="${catImg}" loading="lazy" alt="${escapeHTML(cat)}" style="width:100%; height:100%; object-fit:cover;">
                <div class="cat-banner-overlay">
                    <h2 contenteditable="true" spellcheck="false" class="inline-editable"
                        onclick="event.stopPropagation();"
                        onblur="handleCategoryRename('${cat}', this.innerText)"
                        onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                    >${escapeHTML(cat)}</h2>
                </div>
                <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
                <div class="header-actions">
                    <button class="action-btn btn-delete"
                        onclick="deleteCategory('${cat}'); event.stopPropagation();"
                        title="Apagar Categoria">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <input type="file" id="upload-${safeCat}"
                    onchange="handleCatUpload('${cat}', this)"
                    style="display:none;" accept="image/*">
            </div>`
            : `<div class="slide-title" style="margin-bottom:20px; text-align:center;">
                <span contenteditable="true" spellcheck="false"
                    class="text-editable inline-editable"
                    onblur="handleCategoryRename('${cat}', this.innerText)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}"
                    style="font-size:1.8rem; font-weight:700;"
                >${escapeHTML(cat)}</span>
                
                <div class="cat-banner editable-trigger" onclick="triggerCatUpload('${cat}')" style="background:var(--bg-page);">
                    <div class="edit-overlay" style="opacity:1; border-radius:16px;">
                        <i class="fa-solid fa-camera" style="margin-right:8px;"></i> Adicionar Capa
                    </div>
                    
                    <div class="header-actions-abs" style="position:absolute; top:10px; right:10px; z-index:10;">
                        <button class="action-btn btn-delete"
                            onclick="deleteCategory('${cat}'); event.stopPropagation();"
                            title="Apagar Categoria">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <input type="file" id="upload-${safeCat}" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*">
            </div>`;

        const itemsHTML = groups[cat].map(createItemCard).join('');
        const addItemBtn = `
            <div class="add-item-btn" onclick="openAddItemModal('${cat}')">
                <span><i class="fa-solid fa-plus"></i> Adicionar Prato em "${escapeHTML(cat)}"</span>
            </div>`;

        section.innerHTML = headerHTML + `<div class="items-grid">${itemsHTML}</div>` + addItemBtn;
        track.appendChild(section);
    });

    // Add "Nova Categoria" button
    const addCatBtn = document.createElement('button');
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = () => window.addNewCategoryOptimized();
    addCatBtn.innerHTML = '<i class="fa-solid fa-plus"></i> <span>Nova Categoria</span>';
    navFrag.appendChild(addCatBtn);

    // Flush nav to DOM in one operation
    nav.innerHTML = '';
    nav.appendChild(navFrag);

    // Sync active slide index
    if (state.activeCategoryName) {
        const idx = cats.indexOf(state.activeCategoryName);
        if (idx !== -1) updateState({ currentSlideIndex: idx });
    }

    // Defer expensive operations to after paint
    requestAnimationFrame(() => {
        scrollToSlide(state.currentSlideIndex, { instant: true });

        if (window.Sortable) {
            state.sortableInstance?.destroy();
            updateState({
                sortableInstance: new Sortable(nav, {
                    animation: 150,
                    handle: '.handle',
                    draggable: '.draggable-tab',
                    ghostClass: 'sortable-ghost',
                    onEnd: async () => {
                        const newOrder = Array.from(nav.querySelectorAll('.draggable-tab'))
                            .map(t => t.dataset.category);
                        await saveCategoryOrder(newOrder);
                        const newIdx = Array.from(nav.querySelectorAll('.tab-btn'))
                            .findIndex(b => b.classList.contains('active'));
                        if (newIdx !== -1) updateState({ currentSlideIndex: newIdx });
                    }
                })
            });
        }
    });
}

// ─── Slide Navigation ─────────────────────────────────────────────────────────
export function scrollToSlide(index, options = {}) {
    const track = document.getElementById('editorTrack');
    if (!track?.children.length) return;

    index = Math.max(0, Math.min(index, track.children.length - 1));
    updateState({ currentSlideIndex: index });

    track.style.transition = options.instant
        ? 'none'
        : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    track.style.transform = `translateX(-${index * 100}%)`;

    if (options.instant) void track.offsetHeight; // force reflow

    document.querySelectorAll('.draggable-tab').forEach((t, i) => {
        const active = i === index;
        t.classList.toggle('active', active);
        if (active) updateState({ activeCategoryName: t.dataset.category });
    });

    const container = document.getElementById('menuContainer');
    const currentSlide = track.children[index];
    if (currentSlide && container) {
        container.style.height = `${currentSlide.offsetHeight}px`;
        state.slideObserver?.disconnect();
        const obs = new ResizeObserver(([entry]) => {
            container.style.height = `${entry.target.offsetHeight}px`;
        });
        obs.observe(currentSlide);
        updateState({ slideObserver: obs });
    }
}

// ─── Item Card ────────────────────────────────────────────────────────────────
export function createItemCard(item) {
    const { id, name, description, price, available: isAvail, image_url } = item;
    const eyeIcon = isAvail ? 'fa-eye' : 'fa-eye-slash';
    const eyeColor = isAvail ? 'var(--success)' : '#ccc';

    return `
        <div id="item-card-${id}" class="menu-item${!isAvail ? ' unavailable' : ''} editable-container">
            <div class="item-text">
                <h3 contenteditable="true" spellcheck="false" class="inline-editable"
                    onblur="handleItemUpdate('${id}', 'name', this.innerText)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
                    ${escapeHTML(name)}
                </h3>
                <p contenteditable="true" spellcheck="false" class="item-desc inline-editable"
                    onblur="handleItemUpdate('${id}', 'description', this.innerText)">
                    ${escapeHTML(description)}
                </p>
                <div class="item-footer">
                    <div class="item-price">
                        <span contenteditable="true" spellcheck="false" class="inline-editable"
                            onblur="handleItemUpdate('${id}', 'price', this.innerText)"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
                            ${Number(price).toFixed(2)}
                        </span>€
                    </div>
                    <div class="item-controls">
                        <button class="btn-eye-toggle"
                            onclick="toggleAvailability('${id}', ${isAvail}, this); event.stopPropagation();"
                            title="Visibilidade"
                            style="color:${eyeColor};">
                            <i class="fa-solid ${eyeIcon}"></i>
                        </button>
                        <button class="action-btn btn-delete"
                            onclick="deleteItem('${id}'); event.stopPropagation();"
                            title="Apagar Prato">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="item-img editable-trigger" onclick="openImageModal('${id}')" style="position:relative; background:var(--bg-page);">
                ${image_url
            ? `<img src="${image_url}" loading="lazy" alt="${escapeHTML(name)}" style="width:100%; height:100%; object-fit:cover; display:block;">`
            : `<div class="edit-overlay" style="opacity:1; font-size:0.75rem; flex-direction:column; gap:4px; text-align:center;">
                   <i class="fa-solid fa-camera" style="font-size:1.2rem;"></i>Adicionar<br>Foto
               </div>`
        }
            </div>
        </div>
    `;
}
