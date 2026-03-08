/**
 * render.js - Precise Screenshot Matching
 */
import { state } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;
    if (data.menu_type === 'pdf') return renderPdfView(data);
    renderScreenshotEditor(data, items);
}

export function renderScreenshotEditor(data, items) {
    const container = document.getElementById('menuContainer');
    if (!container) return;

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    // 0. Identity Update
    const nameEl = document.getElementById('restName');
    const descEl = document.getElementById('restDesc');
    const wifiEl = document.getElementById('metaWifi');
    const phoneEl = document.getElementById('metaPhone');
    const addrEl = document.getElementById('metaAddr');
    const coverEl = document.getElementById('coverDisplay');

    if (nameEl) {
        nameEl.innerText = data.name || 'Taberna do Mercado';
        nameEl.onblur = (e) => window.handleRestUpdate('name', e.target.innerText);
    }
    if (descEl) {
        descEl.innerText = data.description || 'Descrição do Restaurante';
        descEl.onblur = (e) => window.handleRestUpdate('description', e.target.innerText);
    }
    if (wifiEl) {
        wifiEl.innerText = data.wifi_name || 'wifi_gratis';
        wifiEl.onblur = (e) => window.handleRestUpdate('wifi_name', e.target.innerText);
    }
    if (phoneEl) {
        phoneEl.innerText = data.phone || '+351 000 000 000';
        phoneEl.onblur = (e) => window.handleRestUpdate('phone', e.target.innerText);
    }
    if (addrEl) {
        addrEl.innerText = data.address || 'Rua Exemplo, 123';
        addrEl.onblur = (e) => window.handleRestUpdate('address', e.target.innerText);
    }
    if (coverEl && data.cover_url) {
        coverEl.src = data.cover_url;
    }

    // 1. Navigation (Screenshot Style)
    const navBar = document.getElementById('categoryNav');
    if (navBar) {
        navBar.innerHTML = cats.map((cat, idx) => `
            <button class="cat-item-link ${idx === state.activeCategoryIdx ? 'active' : ''}" 
                    onclick="window.switchCategory(${idx})">
                <span class="cat-link-text">${escapeHTML(cat)}</span>
                <span class="cat-link-lines">||</span>
            </button>
        `).join('') + `
            <button class="cat-add-link" onclick="window.addNewCategoryOptimized()">
                <i class="ph ph-plus"></i> Nova Categoria
            </button>
        `;
    }

    // 2. Slider Rendering
    container.innerHTML = `
        <div class="menu-slides-wrapper" id="categorySlider" style="transform: translateX(-${(state.activeCategoryIdx || 0) * 100}%)">
            ${cats.map(cat => {
        const catItems = groups[cat] || [];
        // Find category image (if any)
        const catImage = catItems.find(i => i.category_image)?.category_image || 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1974';

        return `
                    <div class="menu-slide">
                        <div class="cat-image-header" onclick="window.triggerCategoryImageUpload('${cat}')">
                            <img src="${catImage}">
                            <div class="cat-image-overlay">
                                <h2 contenteditable="true" onblur="window.handleCategoryRename('${cat}', this.innerText)">${escapeHTML(cat)}</h2>
                            </div>
                            <button class="cat-delete-btn" onclick="window.deleteCategory('${cat}')" title="Apagar Categoria">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>

                        <div class="items-list">
                            ${catItems.map(i => `
                                <div class="item-card">
                                    <div class="item-card-left">
                                        <div class="item-card-header">
                                            <span class="it-name" contenteditable="true" 
                                                onblur="window.handleItemUpdate('${i.id}', 'name', this.innerText)">${escapeHTML(i.name)}</span>
                                            <span class="it-price" contenteditable="true" 
                                                onblur="window.handleItemPriceUpdate('${i.id}', this.innerText)">${Number(i.price).toFixed(2)}€</span>
                                        </div>
                                        <span class="it-desc" contenteditable="true" 
                                            onblur="window.handleItemUpdate('${i.id}', 'description', this.innerText)">${escapeHTML(i.description)}</span>
                                    </div>
                                    <div class="item-visual" onclick="window.triggerItemImageUpload('${i.id}')">
                                        <img src="${i.image_url || 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1974'}">
                                    </div>
                                </div>
                            `).join('')}
                            
                            <div class="bottom-add-slot" onclick="window.addNewItem('${cat}')">
                                <i class="ph ph-plus"></i> ADICIONAR PRATO
                            </div>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

export function renderPdfView(data) {
    const container = document.getElementById('menuContainer');
    if (!container) return;
    container.innerHTML = `<div style="padding:100px;text-align:center;"><h2>MENU PDF EM USO</h2></div>`;
}

export function updateLiveLink(slug) {
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(`/${slug}`, '_blank');
}

function _getOrderedCategories(items) {
    const catSet = new Set(state.currentData.category_order || []);
    items.forEach(i => catSet.add(i.category));
    return Array.from(catSet);
}
