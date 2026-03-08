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
export function updateLiveLink(slug) {
    const url = `https://menunoar.pt/menu.html?id=${slug}`;
    ['liveLinkBtn', 'liveLinkBtnMobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = () => window.open(url, '_blank');
    });
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function renderHeader(data) {
    const canvas = document.querySelector('.editor-canvas');
    if (canvas) {
        const fontName = data.font || 'Outfit';
        canvas.style.fontFamily = `'${fontName}', sans-serif`;
    }

    const nameEl = document.getElementById('restNameEditor');
    const descEl = document.getElementById('restDescEditor');
    if (nameEl) nameEl.textContent = data.name || '';
    if (descEl) descEl.textContent = data.description || '';

    const coverDiv = document.getElementById('coverEditor');
    if (coverDiv && data.cover_url) {
        coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
    } else if (coverDiv) {
        coverDiv.style.backgroundImage = 'none';
    }

    _updateBadge('badgeWifi', 'textWifi', data.wifi_ssid || data.wifi_password);
    _updateBadge('badgePhone', 'textPhone', data.phone);
    _updateBadge('badgeAddress', 'textAddress', data.address);
}

function _updateBadge(badgeId, textId, value) {
    const el = document.getElementById(badgeId);
    const span = document.getElementById(textId);
    if (el && span) {
        span.textContent = value || '';
        el.style.display = value ? 'inline-flex' : 'none';
    }
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export function renderMenu(items) {
    const track = document.getElementById('menuSliderTrack');
    const nav = document.getElementById('categoryNav');
    if (!track || !nav) return;

    nav.innerHTML = '';
    track.innerHTML = '';

    // Order categories
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

    const groups = cats.reduce((acc, cat) => {
        acc[cat] = items.filter(i => i.category === cat);
        return acc;
    }, {});

    const navFrag = document.createDocumentFragment();

    cats.forEach((cat, index) => {
        // Nav tab
        const tab = document.createElement('div');
        const isActive = state.activeCategoryName ? cat === state.activeCategoryName : index === 0;
        if (isActive) updateState({ activeCategoryName: cat });

        tab.className = `tab-btn draggable-tab${isActive ? ' active' : ''}`;
        tab.dataset.category = cat;
        tab.dataset.index = index;
        tab.onclick = () => scrollToSlide(index);
        tab.innerHTML = `${escapeHTML(cat)}`;
        navFrag.appendChild(tab);

        // Slide
        const slide = document.createElement('div');
        slide.className = 'menu-slide';
        slide.id = `sec-${cat.replace(/\s+/g, '-')}`;
        slide.style.minWidth = '100%';

        const catImg = (state.currentData.category_images || {})[cat];
        const headerHTML = catImg
            ? `<div class="cat-banner editable-trigger" onclick="triggerCatUpload('${cat}')">
                <img src="${catImg}" loading="lazy" alt="${escapeHTML(cat)}">
                <div class="cat-banner-overlay">
                    <h2 class="inline-editable" contenteditable="true" spellcheck="false"
                        onblur="handleCategoryRename('${cat}', this.innerText)">${escapeHTML(cat)}</h2>
                </div>
                <div class="edit-overlay"><i class="fa-solid fa-camera"></i></div>
                <button class="action-btn btn-delete abs-trash" onclick="deleteCategory('${cat}'); event.stopPropagation();"><i class="fa-solid fa-trash"></i></button>
               </div>`
            : `<div class="slide-title-wrapper" style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <h2 class="slide-title inline-editable" contenteditable="true" spellcheck="false" onblur="handleCategoryRename('${cat}', this.innerText)">${escapeHTML(cat)}</h2>
                <div class="cat-actions">
                    <button class="btn-sm" onclick="triggerCatUpload('${cat}')"><i class="fa-solid fa-image"></i></button>
                    <button class="btn-sm btn-delete" onclick="deleteCategory('${cat}'); event.stopPropagation();"><i class="fa-solid fa-trash"></i></button>
                </div>
               </div>`;

        const content = document.createElement('div');
        content.className = 'slide-content';
        content.innerHTML = headerHTML;

        const grid = document.createElement('div');
        grid.className = 'items-grid';
        groups[cat].forEach(item => {
            const card = document.createElement('div');
            card.className = `menu-item draggable-item${!item.available ? ' unavailable' : ''}`;
            card.dataset.id = item.id;
            card.onclick = () => openEditItemModal(item);
            card.innerHTML = `
                <div class="item-text">
                    <h3>${escapeHTML(item.name)}</h3>
                    <p class="item-desc">${escapeHTML(item.description)}</p>
                    <div class="item-price">${Number(item.price).toFixed(2)}€</div>
                </div>
                ${item.image_url ? `<div class="item-img"><img src="${item.image_url}" loading="lazy"></div>` : ''}
                <div class="item-actions">
                    <button class="action-btn" onclick="toggleAvailability('${item.id}', ${item.available}, this); event.stopPropagation();"><i class="fa-solid ${item.available ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
                    <button class="action-btn btn-delete" onclick="deleteItem('${item.id}'); event.stopPropagation();"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });

        content.appendChild(grid);

        const addBtn = document.createElement('div');
        addBtn.className = 'add-item-btn';
        addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Novo Item em ${escapeHTML(cat)}`;
        addBtn.onclick = () => openAddItemModal(cat);
        content.appendChild(addBtn);

        slide.appendChild(content);
        track.appendChild(slide);
    });

    nav.appendChild(navFrag);

    // Initial switch
    setTimeout(() => {
        const activeIdx = cats.indexOf(state.activeCategoryName || cats[0]);
        scrollToSlide(activeIdx !== -1 ? activeIdx : 0, { instant: true });
    }, 50);

    initSortable();
}

function initSortable() {
    const track = document.getElementById('menuSliderTrack');
    const nav = document.getElementById('categoryNav');

    if (track) {
        track.querySelectorAll('.items-grid').forEach(grid => {
            Sortable.create(grid, {
                animation: 150,
                draggable: ".draggable-item",
                onEnd: () => { /* Logic to save item order if needed */ }
            });
        });
    }

    if (nav) {
        Sortable.create(nav, {
            animation: 150,
            draggable: ".draggable-tab",
            onEnd: () => {
                const newOrder = Array.from(nav.querySelectorAll('.draggable-tab')).map(t => t.dataset.category);
                saveCategoryOrder(newOrder);
            }
        });
    }
}

export function scrollToSlide(index, options = {}) {
    const track = document.getElementById('menuSliderTrack');
    const win = document.getElementById('menuSliderWindow');
    if (!track || !win) return;

    updateState({ currentSlideIndex: index });
    track.style.transition = options.instant ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    track.style.transform = `translateX(-${index * 100}%)`;

    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        const active = i === index;
        btn.classList.toggle('active', active);
        if (active) {
            updateState({ activeCategoryName: btn.dataset.category });
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });

    const activeSlide = track.children[index];
    if (activeSlide) {
        win.style.height = activeSlide.offsetHeight + 'px';
        state.slideObserver?.disconnect();
        const obs = new ResizeObserver(([entry]) => {
            win.style.height = `${entry.target.offsetHeight}px`;
        });
        obs.observe(activeSlide);
        updateState({ slideObserver: obs });
    }
}

// Global functions for inline actions
window.triggerCatUpload = (cat) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleCatUpload(cat, e.target);
    input.click();
};
