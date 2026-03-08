/**
 * render.js - Studio Edition
 * Perfectly aligned with the lifestyle premium identity of Menu no Ar.
 * Focus: High-quality typography, clean bento cards, and a cinematic mobile preview.
 */
import { state, updateState } from './state.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHTML = (str) => str ? String(str).replace(/[&<>"']/g, m => ESC[m]) : '';

// ─── MASTER RENDER ───
export function renderAll() {
    const data = state.currentData;
    const items = state.menuItems;

    if (data.menu_type === 'pdf') {
        renderPdfStudio(data);
    } else {
        renderBlueprint(items);
        renderStudioPreview(data, items);
    }
}

// ─── BLUEPRINT: THE BENTO GRID (Management) ───
export function renderBlueprint(items) {
    const container = document.getElementById('categories-blueprint');
    if (!container) return;

    container.innerHTML = '';

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    cats.forEach((cat, index) => {
        const catItems = groups[cat] || [];
        const card = document.createElement('div');
        card.className = `bento-card reveal-shadow delay-${(index % 5) + 1}`;

        card.innerHTML = `
            <div class="card-header">
                <input class="cat-edit-input" value="${escapeHTML(cat)}" 
                    onblur="window.handleCategoryRename('${cat}', this.value)">
                <div class="card-actions">
                    <button class="btn btn-ghost sm" onclick="openAddItemModal('${cat}')"><i class="ph ph-plus-circle"></i></button>
                    <button class="btn btn-ghost sm text-danger" onclick="deleteCategory('${cat}')"><i class="ph ph-trash"></i></button>
                </div>
            </div>
            <div class="items-list">
                ${catItems.map(item => `
                    <div class="item-strip ${!item.available ? 'unavailable' : ''}" onclick="openItemModal('${item.id}')">
                        <div class="item-info">
                            <strong>${escapeHTML(item.name)}</strong>
                            <span>${_truncateDesc(item.description)}</span>
                        </div>
                        <div class="item-price">${Number(item.price).toFixed(2)}€</div>
                    </div>
                `).join('')}
                ${catItems.length === 0 ? '<p class="text-muted" style="font-size:0.8rem; text-align:center; padding: 20px;">Sem pratos nesta categoria.</p>' : ''}
            </div>
        `;
        container.appendChild(card);
    });

    // Re-trigger reveal animations if needed
    _triggerReveal();
}

// ─── STUDIO PREVIEW: THE CINEMATIC RENDER (Visual) ───
export function renderStudioPreview(data, items) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;

    const font = data.font || 'Inter';
    canvas.style.fontFamily = `'${font}', sans-serif`;

    const cats = _getOrderedCategories(items);
    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    canvas.innerHTML = `
        <div class="studio-render-header" style="height: 38% !important; background: url('${data.cover_url || ''}') center/cover; position:relative;">
            <div style="position:absolute; inset:0; background: linear-gradient(0deg, #fff 0%, transparent 60%);"></div>
            <button class="studio-img-btn" onclick="triggerCoverUpload()" style="position:absolute; bottom: 20px; right: 20px; border-radius: 50%; width: 44px; height: 44px; border:none; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); cursor:pointer;">
                <i class="ph ph-camera" style="font-size:1.2rem;"></i>
            </button>
        </div>
        
        <div class="studio-render-info" style="padding: 24px; text-align: center; background: #fff;">
            <h1 style="font-family: 'Outfit', sans-serif; font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">${escapeHTML(data.name)}</h1>
            <p style="color: #64748b; font-size: 0.9rem;">${escapeHTML(data.description)}</p>
            
            <div style="display:flex; justify-content:center; gap: 8px; margin-top: 16px;">
                ${data.wifi_password ? `<div class="badge" style="background:var(--primary-soft); color:var(--primary);"><i class="ph ph-wifi-high"></i> WiFi</div>` : ''}
                ${data.phone ? `<div class="badge" style="background:#f1f5f9; color:#475569;"><i class="ph ph-phone"></i></div>` : ''}
            </div>
        </div>

        <div class="studio-render-body" style="padding: 0 24px 80px; background: #fff;">
            ${cats.map(cat => {
        const catItems = groups[cat] || [];
        if (catItems.length === 0) return '';
        return `
                    <div style="margin-top: 32px;">
                        <h3 style="font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 800; margin-bottom: 20px; border-bottom: 1.5px solid #000; display:inline-block; padding-bottom: 4px;">${escapeHTML(cat)}</h3>
                        <div style="display:flex; flex-direction:column; gap: 24px;">
                            ${catItems.map(i => `
                                <div style="display:flex; justify-content:space-between; gap: 16px;">
                                    <div style="flex:1;">
                                        <strong style="display:block; font-size: 1rem; margin-bottom: 4px;">${escapeHTML(i.name)}</strong>
                                        <p style="font-size: 0.75rem; color: #64748b; line-height: 1.4;">${escapeHTML(i.description)}</p>
                                    </div>
                                    <div style="font-weight: 800; font-size: 1rem;">${Number(i.price).toFixed(2)}€</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// ─── PDF STUDIO ───
export function renderPdfStudio(data) {
    const canvas = document.getElementById('menuContainer');
    if (!canvas) return;
    canvas.innerHTML = `
        <div style="height: 100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px; text-align: center;">
            <i class="ph ph-file-pdf" style="font-size: 4rem; color: #ef4444; margin-bottom: 20px;"></i>
            <h2 style="font-family: 'Outfit', sans-serif;">Menu PDF Ativo</h2>
            <p style="color: #64748b; margin-top: 12px; font-size: 0.9rem;">A sua ementa está a ser servida como um ficheiro descarregável.</p>
            <a href="${data.pdf_url}" target="_blank" class="btn btn-primary" style="margin-top:32px;">Abrir PDF</a>
        </div>
    `;
}

// ─── HELPERS ───
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

function _truncateDesc(text, max = 50) {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '...' : text;
}

function _triggerReveal() {
    setTimeout(() => {
        document.querySelectorAll('.bento-card').forEach(c => c.classList.add('is-visible'));
    }, 100);
}

export function updateLiveLink(slug) {
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(`https://menunoar.pt/menu.html?id=${slug}`, '_blank');
}
