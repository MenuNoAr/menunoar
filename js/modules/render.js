/**
 * render.js - Hub "Command Hub" Version
 * Renders the Blueprint (Left) and the Studio (Right)
 */
import { state, updateState } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

// ─── Main Render Dispatch ───
export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    if (data.menu_type === 'pdf') {
        renderPdfStudio(data);
    } else {
        renderStudioPreview(data, items);
        renderBlueprint(items);
    }
}

// ─── THE BLUEPRINT (Left Panel) ───
export function renderBlueprint(items) {
    const container = document.getElementById('categories-list');
    if (!container) return;

    container.innerHTML = '';

    // Grouping
    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    cats.forEach((cat) => {
        const catBox = document.createElement('div');
        catBox.className = 'cat-blueprint-box animate-fade';

        const catItems = groups[cat] || [];
        const itemsHTML = catItems.map(item => `
            <div class="item-row ${!item.available ? 'unavailable' : ''}" onclick="openItemModal('${item.id}')">
                <div class="item-name-box">
                    ${escapeHTML(item.name)}
                </div>
                <div class="item-price-box">${Number(item.price).toFixed(2)}€</div>
                <i class="ph ph-note-pencil"></i>
            </div>
        `).join('');

        catBox.innerHTML = `
            <div class="cat-head-row">
                <input class="cat-name-input" value="${escapeHTML(cat)}" 
                    onblur="window.handleCategoryRename('${cat}', this.value)">
                <div class="cat-actions">
                    <button class="icon-btn" onclick="openAddItemModal('${cat}')"><i class="ph ph-plus"></i></button>
                    <button class="icon-btn text-danger" onclick="deleteCategory('${cat}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="items-blueprint-list">
                ${itemsHTML || '<p class="muted center">Nenhum prato aqui.</p>'}
            </div>
        `;
        container.appendChild(catBox);
    });
}

// ─── THE STUDIO PREVIEW (Right Panel Card) ───
export function renderStudioPreview(data, items) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    // Build the visual "Menu" inside the card as it would look on mobile
    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    const font = data.font || 'Inter';
    canvas.style.fontFamily = `'${font}', sans-serif`;

    canvas.innerHTML = `
        <div class="preview-header" style="background-image: url('${data.cover_url || ''}'); height: 200px; background-size: cover; background-position: center; position:relative;">
            <div style="position:absolute; inset:0; background: rgba(0,0,0,0.3);"></div>
        </div>
        <div class="preview-info" style="padding: 32px 24px; text-align: center;">
            <h1 style="font-size: 1.8rem; margin-bottom: 8px;">${escapeHTML(data.name)}</h1>
            <p class="muted">${escapeHTML(data.description)}</p>
        </div>
        <div class="preview-menu-content" style="padding: 0 24px 80px;">
            ${cats.map(cat => `
                <div style="margin-bottom: 40px;">
                    <h3 style="font-size: 1.25rem; font-weight: 800; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">${escapeHTML(cat)}</h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${(groups[cat] || []).map(i => `
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div>
                                    <strong style="font-size: 0.95rem; display:block;">${escapeHTML(i.name)}</strong>
                                    <span style="font-size: 0.8rem; color: #666;">${escapeHTML(i.description)}</span>
                                </div>
                                <span style="font-weight: 800; font-size: 0.95rem;">${Number(i.price).toFixed(2)}€</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ─── PDF Render ───
export function renderPdfStudio(data) {
    const canvas = document.getElementById('menuContainer');
    if (canvas) {
        canvas.innerHTML = `
            <div style="padding: 100px 40px; text-align: center;">
                <i class="ph ph-file-pdf" style="font-size: 4rem; color: #ff0000; margin-bottom: 20px;"></i>
                <h2>Modo PDF Ativo</h2>
                <p class="muted">O seu menu está a ser servido via ficheiro.</p>
                <a href="${data.pdf_url}" target="_blank" class="hub-btn block primary" style="margin-top:20px;">Ver PDF</a>
            </div>
        `;
    }
}

// ─── Helpers ───
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
