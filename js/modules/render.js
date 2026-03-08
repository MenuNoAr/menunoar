/**
 * render.js - Optimized UI Rendering for Device Preview
 */
import { state, updateState } from './state.js';
import { saveCategoryOrder } from './api.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

// ─── Live Link ────────────────────────────────────────────────────────────────
export function updateLiveLink(slug) {
    const url = `https://menunoar.pt/menu.html?id=${slug}`;
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(url, '_blank');
}

// ─── Header Rendering ───
export function renderHeader(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    // Apply Fonts
    const fontName = data.font || 'Inter';
    const fontType = fontName.includes('Playfair') ? 'serif' : (fontName.includes('Dancing') ? 'cursive' : 'sans-serif');
    canvas.style.setProperty('--font-heading', `'${fontName}', ${fontType}`);
    canvas.style.fontFamily = `'${fontName}', ${fontType}`;

    // Clear and build the core skeleton if not present
    if (!canvas.querySelector('.rest-info')) {
        canvas.innerHTML = `
            <div id="coverEditor" class="cover-container" onclick="triggerCoverUpload()">
                <div class="cover-overlay"><i class="ph-bold ph-camera"></i></div>
            </div>
            <div class="rest-info">
                <h1 id="restNameEditor" class="inline-edit" contenteditable="true" spellcheck="false">Nome do Restaurante</h1>
                <p id="restDescEditor" class="inline-edit" contenteditable="true" spellcheck="false">Descrição do restaurante...</p>
                <div class="badges-row">
                    <div id="badgeWifi" class="badge-item"><i class="ph-fill ph-wifi"></i> <span id="textWifi">Wi-Fi</span></div>
                    <div id="badgePhone" class="badge-item"><i class="ph-fill ph-phone"></i> <span id="textPhone">Telefone</span></div>
                    <div id="badgeAddress" class="badge-item"><i class="ph-fill ph-map-pin"></i> <span id="textAddress">Morada</span></div>
                </div>
            </div>
            <div id="categoryNav" class="category-tabs sticky-nav"></div>
            <div id="menuSections" class="menu-sections"></div>
            <div class="canvas-footer" style="padding: 40px; text-align: center; opacity: 0.5; font-size: 0.8rem;">
                Feito com Menu no Ar
            </div>
        `;
        // Setup initial event listeners for heading edits
        _setupHeaderListeners();
    }

    // Update Values
    const nameEl = document.getElementById('restNameEditor');
    const descEl = document.getElementById('restDescEditor');
    if (nameEl) nameEl.textContent = data.name || 'Nome do Restaurante';
    if (descEl) descEl.textContent = data.description || 'Descrição curta (clica para editar)';

    const coverDiv = document.getElementById('coverEditor');
    if (coverDiv) {
        if (data.cover_url) {
            coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
            coverDiv.style.backgroundSize = 'cover';
            coverDiv.style.backgroundPosition = 'center';
            coverDiv.style.height = '240px';
        } else {
            coverDiv.style.backgroundImage = 'none';
            coverDiv.style.backgroundColor = '#f1f5f9';
            coverDiv.style.height = '120px';
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
    el.style.opacity = value ? '1' : '0.4';
}

function _setupHeaderListeners() {
    const nameEl = document.getElementById('restNameEditor');
    const descEl = document.getElementById('restDescEditor');

    nameEl?.addEventListener('blur', (e) => window.handleRestUpdate('name', e.target.innerText));
    descEl?.addEventListener('blur', (e) => window.handleRestUpdate('description', e.target.innerText));

    // Wifi, Phone, Address triggers
    document.getElementById('badgeWifi')?.addEventListener('click', () => window.openBadgeEdit('wifi'));
    document.getElementById('badgePhone')?.addEventListener('click', () => window.openBadgeEdit('phone'));
    document.getElementById('badgeAddress')?.addEventListener('click', () => window.openBadgeEdit('address'));
}

// ─── Menu Rendering ───
export function renderMenu(items) {
    const nav = document.getElementById('categoryNav');
    const sections = document.getElementById('menuSections');
    if (!nav || !sections) return;

    sections.innerHTML = '';
    nav.innerHTML = '';

    // Categories Logic
    const catSet = new Set(items.map(i => i.category));
    (state.currentData.category_order || []).forEach(c => catSet.add(c));
    let cats = Array.from(catSet);

    // Sort by order
    if (state.currentData.category_order?.length) {
        const order = state.currentData.category_order;
        cats.sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib);
        });
    }

    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    const navFrag = document.createDocumentFragment();
    const sectionsFrag = document.createDocumentFragment();

    cats.forEach((cat, idx) => {
        // Nav Tab
        const tab = document.createElement('button');
        tab.className = `tab-btn draggable-tab ${idx === 0 ? 'active' : ''}`;
        tab.dataset.category = cat;
        tab.innerHTML = `<span>${escapeHTML(cat)}</span>`;
        tab.onclick = () => {
            document.getElementById(`cat-sec-${idx}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        navFrag.appendChild(tab);

        // Section
        const section = document.createElement('div');
        section.className = 'menu-category-section';
        section.id = `cat-sec-${idx}`;

        const catItems = groups[cat] || [];
        const itemsHTML = catItems.map(createItemCard).join('');

        section.innerHTML = `
            <div class="category-title-row">
                <h2 class="category-title" 
                    contenteditable="true" 
                    onblur="window.handleCategoryRename('${cat}', this.innerText)"
                >${escapeHTML(cat)}</h2>
                <button class="icon-btn text-danger" onclick="deleteCategory('${cat}')" title="Apagar"><i class="ph ph-trash"></i></button>
            </div>
            <div class="items-grid">
                ${itemsHTML}
                <div class="add-item-trigger" onclick="openAddItemModal('${cat}')">
                    <i class="ph ph-plus"></i>
                    <span>Adicionar Prato</span>
                </div>
            </div>
        `;
        sectionsFrag.appendChild(section);
    });

    nav.appendChild(navFrag);
    sections.appendChild(sectionsFrag);

    // Sortable for categories
    if (window.Sortable) {
        new Sortable(nav, {
            animation: 150,
            draggable: '.draggable-tab',
            onEnd: async () => {
                const newOrder = Array.from(nav.querySelectorAll('.draggable-tab')).map(t => t.dataset.category);
                await saveCategoryOrder(newOrder);
            }
        });
    }
}

// ─── Item Card ───
export function createItemCard(item) {
    const { id, name, description, price, available: isAvail, image_url } = item;

    return `
        <div class="menu-item-card ${!isAvail ? 'unavailable' : ''}" onclick="openItemModal('${id}')">
            <div class="item-img editable-trigger" onclick="event.stopPropagation(); openImageModal('${id}')">
                ${image_url
            ? `<img src="${image_url}" loading="lazy" alt="${escapeHTML(name)}">`
            : `<div class="edit-overlay" style="opacity: 1;"><i class="ph ph-camera"></i></div>`
        }
            </div>
            <div class="item-info">
                <div class="item-name-row">
                    <span class="item-name">${escapeHTML(name)}</span>
                    <span class="item-price">${Number(price).toFixed(2)}€</span>
                </div>
                <p class="item-desc">${escapeHTML(description) || 'Sem descrição'}</p>
            </div>
        </div>
    `;
}

// ─── PDF Viewer ───
export function renderPdfViewer(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    canvas.innerHTML = `
        <div id="pdf-reels-container">
            <div id="pdfLoading" style="padding: 100px 40px; text-align: center;">
                <div class="spinner"></div>
                <p style="margin-top: 16px;">A processar preview do PDF...</p>
            </div>
        </div>
    `;

    if (!data.pdf_url) return;

    // Direct embed or use PDF.js fallback
    // For the "Functional" feeling, let's keep the reel logic but cleaner.
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        pdfjsLib.getDocument(data.pdf_url).promise.then(async (pdf) => {
            const container = document.getElementById('pdf-reels-container');
            container.innerHTML = ''; // clear loading

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const wrapper = document.createElement('div');
                wrapper.className = 'pdf-reel-slide';

                const pCanvas = document.createElement('canvas');
                pCanvas.className = 'pdf-canvas';
                pCanvas.height = viewport.height;
                pCanvas.width = viewport.width;

                wrapper.appendChild(pCanvas);
                container.appendChild(wrapper);

                await page.render({ canvasContext: pCanvas.getContext('2d'), viewport }).promise;
            }
        });
    };
    document.head.appendChild(script);
}
