/**
 * render.js - Direct Edition
 * The Menu is the Editor. No-UI focus.
 */
import { state } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    if (data.menu_type === 'pdf') {
        renderPdfDirect(data);
    } else {
        renderDirectEditor(data, items);
    }
}

export function renderDirectEditor(data, items) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    canvas.innerHTML = `
        <!-- Main Image -->
        <div class="zen-cover-zone" onclick="window.triggerCoverUpload()">
            <img src="${data.cover_url || 'https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=2070'}" id="coverDisplay">
            <div class="zen-img-overlay"><i class="ph ph-camera"></i></div>
        </div>

        <div class="rest-info">
            <h1 contenteditable="true" onblur="window.handleRestUpdate('name', this.innerText)">${escapeHTML(data.name)}</h1>
            <p contenteditable="true" onblur="window.handleRestUpdate('description', this.innerText)">${escapeHTML(data.description)}</p>
        </div>

        <div class="menu-sections">
            ${cats.map(cat => {
        const catItems = groups[cat] || [];
        return `
                    <div class="cat-section">
                        <div class="cat-title">
                            <span contenteditable="true" onblur="window.handleCategoryRename('${cat}', this.innerText)">${escapeHTML(cat)}</span>
                            <div class="cat-ghost">
                                <button class="mini-ico red" onclick="window.deleteCategory('${cat}')"><i class="ph ph-trash"></i></button>
                            </div>
                        </div>

                        ${catItems.map(i => `
                            <div class="item-row ${!i.available ? 'muted' : ''}">
                                <div class="item-left">
                                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                        <span class="item-name" contenteditable="true" 
                                            onblur="window.handleItemUpdate('${i.id}', 'name', this.innerText)">${escapeHTML(i.name)}</span>
                                        <span class="item-price" contenteditable="true" 
                                            onblur="window.handleItemPriceUpdate('${i.id}', this.innerText)">${Number(i.price).toFixed(2)}€</span>
                                    </div>
                                    <span class="item-desc" contenteditable="true" 
                                        onblur="window.handleItemUpdate('${i.id}', 'description', this.innerText)">${escapeHTML(i.description)}</span>
                                </div>
                                
                                <div class="item-img-mini" onclick="window.triggerItemImageUpload('${i.id}')">
                                    <img src="${i.image_url || 'https://images.unsplash.com/photo-1546241072-48010ad28c2c?q=80&w=1974'}" id="item-img-${i.id}">
                                </div>

                                <div class="ghost-actions">
                                    <button class="mini-ico" onclick="window.toggleAvailability('${i.id}', ${i.available})" title="Disponível">
                                        <i class="ph ph-${i.available ? 'eye' : 'eye-slash'}"></i>
                                    </button>
                                    <button class="mini-ico red" onclick="window.deleteItem('${i.id}')" title="Apagar">
                                        <i class="ph ph-x"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                        
                        <!-- Item Slot Placeholder -->
                        <div class="placeholder-slot" onclick="window.addNewItem('${cat}')">
                            <i class="ph ph-plus"></i> Novo Prato
                        </div>
                    </div>
                `;
    }).join('')}

            <!-- Category Slot Placeholder -->
            <div class="placeholder-slot cat-placeholder" onclick="window.addNewCategoryOptimized()">
                <i class="ph ph-plus"></i> Nova Categoria
            </div>
        </div>
    `;
}

export function renderPdfDirect(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;
    canvas.innerHTML = `
        <div style="padding: 100px 0; text-align: center;">
            <i class="ph ph-file-pdf" style="font-size: 3rem; color: #ff4d4d; margin-bottom: 20px;"></i>
            <h2 style="font-weight: 800;">MENU PDF ATIVO</h2>
            <p style="color: #666; margin-top: 10px;">A sua ementa está a ser servida digitalmente.</p>
            <button class="z-btn block" style="margin-top:40px; border:1px solid #ddd;" onclick="window.openSettingsModal()">Configurar Menu Digital</button>
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
