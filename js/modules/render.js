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
        if (btn) btn.onclick = () => {
            window.open(url, '_blank');
            window.checkTutorialStep('preview');
        };
    });

    const link = document.getElementById('liveLink');
    if (link) link.href = url;
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function renderHeader(data) {
    const canvas = document.querySelector('.editor-canvas');
    if (canvas) {
        const fontName = data.font || 'Inter';
        // Add quotes for fonts with spaces, but Dancing Script is cursive
        const fontType = fontName.includes('Playfair') ? 'serif' : (fontName.includes('Dancing') ? 'cursive' : 'sans-serif');
        canvas.style.setProperty('--font-heading', `'${fontName}', ${fontType}`);
        canvas.style.fontFamily = `'${fontName}', ${fontType}`;
    }

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

    // Force icon and text color to be consistent across all badges
    const icon = el.querySelector('i');
    if (icon) icon.style.color = 'var(--primary)';
    span.style.color = 'var(--text)';
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

    canvas.innerHTML = `
        <div id="pdf-reels-container" style="position:absolute; top:0; left:0; right:0; bottom:0; background: #eaeaeb; overflow-y:scroll; overflow-x:hidden; scroll-snap-type: y mandatory; display: flex; flex-direction: column; align-items: center; -webkit-overflow-scrolling: touch;">
            <div id="pdfLoading" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center; z-index:100;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:3rem; color:var(--primary); margin-bottom:15px;"></i>
                <p style="color:var(--text-muted); font-weight:500; font-family: 'Outfit', sans-serif;">A preparar preview do menu...</p>
            </div>
        </div>
    `;

    // Load PDF.js dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument(data.pdf_url);
        loadingTask.promise.then(async (pdf) => {
            const container = document.getElementById('pdf-reels-container');
            const loadingEl = document.getElementById('pdfLoading');
            if (loadingEl) loadingEl.style.display = 'none';

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                // Reel Slide Wrapper
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'width:100%; height:100%; flex-shrink:0; display:flex; justify-content:center; align-items:center; scroll-snap-align: start; padding: 15px; box-sizing:border-box; position:relative;';

                // Visual indicator for drag/swipe if there are multiple pages
                if (pdf.numPages > 1 && pageNum < pdf.numPages) {
                    const swipeHint = document.createElement('div');
                    swipeHint.innerHTML = '<i class="fa-solid fa-angles-down" style="color:rgba(0,0,0,0.2); font-size:1.5rem; animation: pulse 2s infinite;"></i>';
                    swipeHint.style.cssText = 'position:absolute; bottom:20px; left:50%; transform:translateX(-50%); z-index:10; pointer-events:none;';
                    wrapper.appendChild(swipeHint);

                    // Keyframes injected once
                    if (pageNum === 1 && !document.getElementById('pulse-anim')) {
                        const style = document.createElement('style');
                        style.id = 'pulse-anim';
                        style.innerHTML = '@keyframes pulse { 0% { opacity:0.3; transform:translateY(0); } 50% { opacity:0.8; transform:translateY(10px); } 100% { opacity:0.3; transform:translateY(0); } }';
                        document.head.appendChild(style);
                    }
                }

                const pageCanvas = document.createElement('canvas'); // renamed variable to avoid collision with top-level canvas
                pageCanvas.style.cssText = 'max-width:100%; max-height:100%; box-shadow: 0 10px 30px rgba(0,0,0,0.1); object-fit:contain; border-radius: 4px; background:#fff; opacity:0; transition: opacity 0.4s;';

                wrapper.appendChild(pageCanvas);
                container.appendChild(wrapper);

                // Render PDF page to canvas
                const page = await pdf.getPage(pageNum);
                // Use scale 2.0 to assure sharpness on high-DPI screens
                const viewport = page.getViewport({ scale: 2.0 });
                const context = pageCanvas.getContext('2d');
                pageCanvas.height = viewport.height;
                pageCanvas.width = viewport.width;

                const renderContext = { canvasContext: context, viewport: viewport };
                await page.render(renderContext).promise;

                // Fade in gracefully
                pageCanvas.style.opacity = '1';
            }
        }).catch(e => {
            console.error(e);
            const loadingEl = document.getElementById('pdfLoading');
            if (loadingEl) loadingEl.innerHTML = '<p style="color:var(--danger); font-family:sans-serif;">Erro ao carregar PDF.</p>';
        });
    };

    // Only append if it's not already there
    if (!document.querySelector('script[src*="pdf.min.js"]')) {
        document.head.appendChild(script);
    } else {
        // Force onload if already loaded from previous view
        script.onload();
    }
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
                        window.checkTutorialStep('move_cat');
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
