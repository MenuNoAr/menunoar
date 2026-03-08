/**
 * render.js - Zen Editor Edition
 * Focus: 100% Inline editing directly on the menu.
 */
import { state } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    // Apply accent color & font globally
    _applyBranding(data);

    if (data.menu_type === 'pdf') {
        renderPdfZen(data);
    } else {
        renderZenEditor(data, items);
        renderCategoryNav(items);
    }
}

function _applyBranding(data) {
    const root = document.documentElement;
    if (data.accent_color) root.style.setProperty('--zen-accent', data.accent_color);
    if (data.font) root.style.setProperty('--font-family', `'${data.font}', sans-serif`);
    document.body.style.fontFamily = data.font ? `'${data.font}', sans-serif` : "'Inter', sans-serif";
}

export function renderCategoryNav(items) {
    const nav = document.getElementById('category-nav');
    if (!nav) return;

    const cats = _getOrderedCategories(items);
    nav.innerHTML = cats.map(cat => `
        <button class="nav-chip" onclick="document.getElementById('cat-${cat.replace(/\s+/g, '-')}').scrollIntoView({behavior:'smooth', block: 'center'})">${escapeHTML(cat)}</button>
    `).join('');
}

export function renderZenEditor(data, items) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    canvas.innerHTML = `
        <!-- Header Zone -->
        <div class="zen-cover-zone" onclick="window.triggerCoverUpload()">
            <img src="${data.cover_url || 'https://images.unsplash.com/photo-1514361892635-6b07e31e75f9?q=80&w=2070'}" id="coverDisplay">
            <div class="zen-img-overlay"><i class="ph ph-camera"></i></div>
        </div>

        <div class="zen-rest-info">
            <h1 contenteditable="true" onblur="window.handleRestUpdate('name', this.innerText)">${escapeHTML(data.name)}</h1>
            <p contenteditable="true" onblur="window.handleRestUpdate('description', this.innerText)">${escapeHTML(data.description)}</p>
        </div>

        <div class="zen-menu-body">
            ${cats.map(cat => {
        const catItems = groups[cat] || [];
        return `
                    <section class="zen-cat-block" id="cat-${cat.replace(/\s+/g, '-')}">
                        <div class="zen-cat-header">
                            <h3 class="zen-cat-title" contenteditable="true" 
                                onblur="window.handleCategoryRename('${cat}', this.innerText)">${escapeHTML(cat)}</h3>
                            <div class="cat-micro-actions">
                                <button class="mini-btn danger" onclick="window.deleteCategory('${cat}')"><i class="ph ph-trash"></i></button>
                            </div>
                        </div>
                        
                        <div class="zen-items-stack">
                            ${catItems.map(i => `
                                <div class="zen-item-row ${!i.available ? 'muted' : ''}">
                                    <div class="item-main">
                                        <span class="item-name" contenteditable="true" 
                                            onblur="window.handleItemUpdate('${i.id}', 'name', this.innerText)">${escapeHTML(i.name)}</span>
                                        <span class="item-desc" contenteditable="true" 
                                            onblur="window.handleItemUpdate('${i.id}', 'description', this.innerText)">${escapeHTML(i.description)}</span>
                                    </div>
                                    <div class="item-price" contenteditable="true" 
                                        onblur="window.handleItemPriceUpdate('${i.id}', this.innerText)">${Number(i.price).toFixed(2)}€</div>
                                    
                                    <div class="ghost-actions">
                                        <button class="mini-btn" onclick="window.toggleAvailability('${i.id}', ${i.available})" title="Disponibilidade">
                                            <i class="ph ph-${i.available ? 'eye' : 'eye-slash'}"></i>
                                        </button>
                                        <button class="mini-btn danger" onclick="window.deleteItem('${i.id}')" title="Apagar">
                                            <i class="ph ph-x"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                            <div class="item-add-dummy" onclick="window.addNewItem('${cat}')">
                                <i class="ph ph-plus-circle"></i> Adicionar Prato
                            </div>
                        </div>
                    </section>
                `;
    }).join('')}
        </div>
    `;
}

export function renderPdfZen(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;
    canvas.innerHTML = `
        <div style="padding: 100px 40px; text-align: center;">
            <i class="ph ph-file-pdf" style="font-size: 3rem; color: #ef4444; margin-bottom: 20px;"></i>
            <h2>Modo PDF Ativo</h2>
            <p class="muted">Menu servido via ficheiro.</p>
            <button class="z-btn primary block" style="margin-top:24px;" onclick="window.openSettingsModal()">Definições de PDF</button>
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

export function updateLiveLink(slug) {
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(`https://menunoar.pt/menu.html?id=${slug}`, '_blank');
}
