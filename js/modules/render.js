/**
 * render.js - LUXE Fine Dining Studio Edition
 * Focus: High-end typography, large dish imagery, and sophisticated whitespace.
 */
import { state } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    // Apply branding settings globally
    _applyLuxuryBranding(data);

    if (data.menu_type === 'pdf') {
        renderPdfZen(data);
    } else {
        renderZenEditor(data, items);
        renderCategoryNav(items);
    }
}

function _applyLuxuryBranding(data) {
    const root = document.documentElement;
    // Set custom font pairings
    if (data.font === 'Outfit') {
        root.style.setProperty('--font-serif', "'Outfit', sans-serif");
    } else if (data.font === 'Playfair Display') {
        root.style.setProperty('--font-serif', "'Playfair Display', serif");
    } else {
        root.style.setProperty('--font-serif', "'Cormorant Garamond', serif");
    }

    if (data.accent_color) root.style.setProperty('--studio-accent', data.accent_color);
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
        <!-- Minimalist Hero Zone -->
        <div class="zen-cover-zone" onclick="window.triggerCoverUpload()">
            <img src="${data.cover_url || 'https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=2070'}" id="coverDisplay">
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
                                        <div class="item-head">
                                            <span class="item-name" contenteditable="true" 
                                                onblur="window.handleItemUpdate('${i.id}', 'name', this.innerText)">${escapeHTML(i.name)}</span>
                                            <span class="item-price" contenteditable="true" 
                                                onblur="window.handleItemPriceUpdate('${i.id}', this.innerText)">${Number(i.price).toFixed(2)}€</span>
                                        </div>
                                        <span class="item-desc" contenteditable="true" 
                                            onblur="window.handleItemUpdate('${i.id}', 'description', this.innerText)">${escapeHTML(i.description)}</span>
                                    </div>
                                    
                                    <div class="item-img-zone" onclick="window.triggerItemImageUpload('${i.id}')" title="Upload Imagem do Prato">
                                        <img src="${i.image_url || 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1974'}" id="item-img-${i.id}">
                                    </div>

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
                                <i class="ph ph-plus-circle"></i> Novo Prato em ${escapeHTML(cat)}
                            </div>
                        </div>
                    </section>
                `;
    }).join('') || '<div style="text-align:center; color: #64748B; margin: 100px 0;">Crie a sua primeira categoria para começar.</div>'}
        </div>
    `;
}

export function renderPdfZen(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;
    canvas.innerHTML = `
        <div style="padding: 160px 40px; text-align: center;">
            <i class="ph ph-file-pdf" style="font-size: 4rem; color: #EF4444; margin-bottom: 24px;"></i>
            <h2 style="font-family: var(--font-serif); font-size: 2.2rem; font-weight: 300;">MODO PDF ATIVO</h2>
            <p style="color: #64748B; font-weight: 300; margin-top: 12px; letter-spacing: 0.1em; text-transform: uppercase;">A sua ementa está a ser servida digitalmente.</p>
            <button class="z-btn primary block" style="margin-top:48px;" onclick="window.openSettingsModal()">Definições de Menu</button>
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
