/**
 * render.js - UI Rendering (Modern Clean Expansion)
 * Removed horizontal slider logic for a full-width vertical workspace.
 */
import { state, updateState } from './state.js';
import { saveCategoryOrder } from './api.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

// ─── Live Link ────────────────────────────────────────────────────────────────
export function updateLiveLink(slug) {
    const url = `${window.location.origin}/menu.html?id=${slug}`;
    const btn = document.getElementById('liveLinkBtn');
    if (btn) {
        btn.onclick = () => window.open(url, '_blank');
    }
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function renderHeader(data) {
    const nameEl = document.getElementById('restNameEditor');
    const descEl = document.getElementById('restDescEditor');
    if (nameEl) nameEl.textContent = data.name || 'Nome do Restaurante';
    if (descEl) descEl.textContent = data.description || 'Descrição curta do seu restaurante...';

    const coverDiv = document.getElementById('coverEditor');
    if (coverDiv) {
        const existingImg = coverDiv.querySelector('img');
        if (data.cover_url) {
            if (existingImg) {
                existingImg.src = data.cover_url;
            } else {
                coverDiv.insertAdjacentHTML('afterbegin', `<img src="${data.cover_url}" alt="Capa" style="width:100%; height:100%; object-fit:cover;">`);
            }
            coverDiv.style.height = '300px';
        } else {
            if (existingImg) existingImg.remove();
            coverDiv.style.height = '180px';
            coverDiv.style.backgroundColor = 'var(--bg-page)';
        }
    }

    _updateBadge('badgeWifi', 'textWifi', data.wifi_password, 'Wi-Fi');
    _updateBadge('badgePhone', 'textPhone', data.phone, 'Contacto');
}

function _updateBadge(badgeId, textId, value, defaultText) {
    const el = document.getElementById(badgeId);
    const span = document.getElementById(textId);
    if (!el || !span) return;
    span.textContent = value || defaultText;
    el.style.opacity = value ? '1' : '0.4';
}

// ─── PDF Viewer ───────────────────────────────────────────────────────────────
export function renderPdfViewer(data) {
    const container = document.getElementById('pdf-reels-container');
    const menuSec = document.getElementById('menuSections');
    if (container) container.style.display = 'flex';
    if (menuSec) menuSec.style.display = 'none';

    if (!data.pdf_url) return;

    // Load PDF.js dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const loadingTask = pdfjsLib.getDocument(data.pdf_url);
        loadingTask.promise.then(async (pdf) => {
            if (container) container.innerHTML = ''; // Clear previous
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const pageCanvas = document.createElement('canvas');
                pageCanvas.style.cssText = 'width:100%; max-width:800px; margin: 0 auto; box-shadow: var(--shadow-md); border-radius: var(--radius-md); background:#fff;';
                container.appendChild(pageCanvas);

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 });
                const context = pageCanvas.getContext('2d');
                pageCanvas.height = viewport.height;
                pageCanvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;
            }
        });
    };
    if (!document.querySelector('script[src*="pdf.min.js"]')) {
        document.head.appendChild(script);
    } else {
        script.onload();
    }
}

// ─── Menu Rendering ──────────────────────────────────────────────────────────
export function renderMenu(items) {
    const container = document.getElementById('menuSections');
    const nav = document.getElementById('categoryNav');
    if (!container || !nav) return;

    // Build categories order
    const catSet = new Set(items.map(i => i.category));
    (state.currentData.category_order || []).forEach(c => catSet.add(c));
    let cats = Array.from(catSet);

    if (state.currentData.category_order?.length) {
        const order = state.currentData.category_order;
        cats.sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
    }

    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    // Render Menu Sections
    container.innerHTML = '';
    cats.forEach(cat => {
        const section = document.createElement('section');
        section.id = `cat-sec-${cat.replace(/\s+/g, '-')}`;
        section.className = 'menu-section animate-fade';

        const catItems = groups[cat] || [];
        const itemsHTML = catItems.map(createItemCard).join('');

        section.innerHTML = `
            <div class="category-header">
                <h2 class="category-title inline-edit" 
                    contenteditable="true" 
                    onblur="handleCategoryRename('${cat}', this.innerText)"
                    onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${escapeHTML(cat)}</h2>
                <div class="flex gap-2">
                    <button class="btn btn-ghost" onclick="deleteCategory('${cat}')" style="color:var(--danger)" title="Eliminar Categoria"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="items-grid">
                ${itemsHTML}
                <div class="menu-item-card add-item-trigger" onclick="openAddItemModal('${cat}')" style="border: 2px dashed var(--border-color); background: transparent; cursor: pointer; align-items: center; justify-content: center; min-height: 200px; opacity: 0.6; transition: var(--transition);">
                    <div style="text-align: center;">
                        <i class="ph ph-plus-circle" style="font-size: 2.5rem; margin-bottom: 12px; color: var(--text-muted);"></i>
                        <div style="font-weight: 600; color: var(--text-muted);">Adicionar Prato</div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(section);
    });

    // Add Category Button at the bottom
    const addCatBox = document.createElement('div');
    addCatBox.className = 'add-category-inline';
    addCatBox.innerHTML = `
        <button class="btn btn-secondary" onclick="window.addNewCategoryOptimized()" style="width:100%; border: 2px dashed var(--border-color); background: transparent; padding: 24px;">
            <i class="ph ph-plus-circle"></i> Adicionar Nova Categoria
        </button>
    `;
    container.appendChild(addCatBox);

    // Enable Vertical Drag for Categories
    if (window.Sortable) {
        new Sortable(container, {
            animation: 150,
            handle: '.category-title', // Drag by the title
            draggable: '.menu-section',
            onEnd: async () => {
                const newOrder = Array.from(container.querySelectorAll('.menu-section')).map(s => {
                    // Extract cat name from ID: cat-sec-Name -> Name
                    return s.querySelector('.category-title').innerText.trim();
                });
                await saveCategoryOrder(newOrder);
            }
        });
    }
}

export function createItemCard(item) {
    const { id, name, description, price, available, image_url } = item;
    return `
        <article class="menu-item-card ${available ? '' : 'unavailable'}" id="item-${id}">
            <div class="item-visual" onclick="openImageModal('${id}')">
                ${image_url ? `<img src="${image_url}" loading="lazy" alt="${escapeHTML(name)}">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); opacity:0.3;"><i class="ph ph-image-square" style="font-size:3rem;"></i></div>`}
                <div class="cover-overlay"><i class="ph ph-camera"></i></div>
            </div>
            <div class="item-details">
                <div class="item-top">
                    <h3 class="item-name inline-edit" contenteditable="true" onblur="handleItemUpdate('${id}', 'name', this.innerText)">${escapeHTML(name)}</h3>
                    <span class="item-price inline-edit" contenteditable="true" onblur="handleItemUpdate('${id}', 'price', this.innerText)">${Number(price).toFixed(2)}</span>
                </div>
                <p class="item-description inline-edit" contenteditable="true" onblur="handleItemUpdate('${id}', 'description', this.innerText)">${escapeHTML(description)}</p>
                <div class="item-actions">
                    <button class="btn btn-ghost" onclick="openEditItemModal('${id}')"><i class="ph ph-pencil"></i></button>
                    <button class="btn btn-ghost" onclick="toggleAvailability('${id}', ${available}, this)" style="color:${available ? 'var(--success)' : 'var(--text-muted)'}"><i class="ph ph-${available ? 'eye' : 'eye-slash'}"></i></button>
                    <button class="btn btn-ghost" onclick="deleteItem('${id}')" style="color:var(--danger)"><i class="ph ph-trash"></i></button>
                </div>
            </div>
        </article>
    `;
}

// Backward compatibility for existing event handlers
export function scrollToSlide(index) {
    // In the new vertical layout, we scroll to the category section instead of a slide
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    const tabs = nav.querySelectorAll('.draggable-tab');
    if (tabs[index]) {
        tabs[index].click();
    }
}
window.scrollToSlide = scrollToSlide;
