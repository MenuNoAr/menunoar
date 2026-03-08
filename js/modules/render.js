/**
 * render.js - Direct Slider Edition
 */
import { state } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    if (data.menu_type === 'pdf') {
        renderPdfView(data);
    } else {
        renderSliderEditor(data, items);
    }
}

export function renderSliderEditor(data, items) {
    const container = document.getElementById('menuContainer');
    if (!container) return;

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    // 0. Update Top Info (Outside Slider)
    const nameEl = document.getElementById('restName');
    const descEl = document.getElementById('restDesc');
    if (nameEl) {
        nameEl.innerText = data.name || 'Nome do Restaurante';
        nameEl.onblur = (e) => window.handleRestUpdate('name', e.target.innerText);
    }
    if (descEl) {
        descEl.innerText = data.description || 'Slogan ou descrição curta...';
        descEl.onblur = (e) => window.handleRestUpdate('description', e.target.innerText);
    }

    // 1. Render Navigation Bar
    const navBar = document.getElementById('categoryNav');
    if (navBar) {
        navBar.className = "category-nav-bar";
        navBar.innerHTML = cats.map((cat, idx) => `
            <button class="cat-chip ${idx === state.activeCategoryIdx ? 'active' : ''}" 
                    onclick="window.switchCategory(${idx})">${escapeHTML(cat)}</button>
        `).join('') + `
            <button class="cat-chip add-btn" onclick="window.addNewCategoryOptimized()"><i class="ph ph-plus"></i></button>
        `;
    }

    // 2. Render Main Viewport & Slider
    container.innerHTML = `
        <div class="menu-viewport">
            <div class="category-slider" id="categorySlider" style="transform: translateX(-${(state.activeCategoryIdx || 0) * 100}%)">
                ${cats.map(cat => {
        const catItems = groups[cat] || [];
        return `
                        <div class="category-slide">
                            <h2 class="cat-title" contenteditable="true" 
                                onblur="window.handleCategoryRename('${cat}', this.innerText)"
                                style="font-size: 1.4rem; font-weight: 800; margin-bottom: 24px; border-bottom: 2px solid var(--menu-text); padding-bottom: 8px;">
                                ${escapeHTML(cat)}
                            </h2>
                            
                            <div class="items-list">
                                ${catItems.map(i => `
                                    <div class="item-card ${!i.available ? 'muted' : ''}">
                                        <div class="item-info">
                                            <div class="item-title-row">
                                                <span class="item-name" contenteditable="true" 
                                                    onblur="window.handleItemUpdate('${i.id}', 'name', this.innerText)">${escapeHTML(i.name)}</span>
                                                <span class="item-price" contenteditable="true" 
                                                    onblur="window.handleItemPriceUpdate('${i.id}', this.innerText)">${Number(i.price).toFixed(2)}€</span>
                                            </div>
                                            <span class="item-desc" contenteditable="true" 
                                                onblur="window.handleItemUpdate('${i.id}', 'description', this.innerText)">${escapeHTML(i.description)}</span>
                                        </div>
                                        
                                        <div class="item-thumb" onclick="window.triggerItemImageUpload('${i.id}')">
                                            <img src="${i.image_url || 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1974'}" id="item-img-${i.id}">
                                        </div>

                                        <div class="card-tools">
                                            <button class="tool-btn" onclick="window.toggleAvailability('${i.id}', ${i.available})">
                                                <i class="ph ph-${i.available ? 'eye' : 'eye-slash'}"></i>
                                            </button>
                                            <button class="tool-btn red" onclick="window.deleteItem('${i.id}')">
                                                <i class="ph ph-x"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                                
                                <div class="add-slot" onclick="window.addNewItem('${cat}')">
                                    <i class="ph ph-plus"></i> Novo Prato em ${escapeHTML(cat)}
                                </div>
                            </div>
                            
                            <div style="margin-top: 40px; text-align: right;">
                                <button class="tool-btn red" onclick="window.deleteCategory('${cat}')" style="width: auto; padding: 0 12px; font-size: 0.7rem;">APAGAR CATEGORIA</button>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

export function renderPdfView(data) {
    const container = document.getElementById('menuContainer');
    if (!container) return;
    container.innerHTML = `
        <div style="padding: 100px 0; text-align: center;">
            <i class="ph ph-file-pdf" style="font-size: 3rem; color: #EF4444; margin-bottom: 20px;"></i>
            <h2 style="font-weight: 800;">MENU PDF ATIVO</h2>
            <p style="color: var(--menu-muted); margin-top: 10px;">A ementa está a ser servida digitalmente.</p>
            <button class="cat-chip active" style="margin-top:40px;" onclick="window.openSettingsModal()">Configurações</button>
        </div>
    `;
}

function _getOrderedCategories(items) {
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
    return cats;
}
