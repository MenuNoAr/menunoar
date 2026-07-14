export const ITEM_PLACEHOLDER_IMAGE = 'assets/images/item-placeholder.svg';

const ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const THEME_DEFAULTS = {
    text: '#1a1a1a',
    background: '#ffffff',
    textSecondary: '#666666',
};

export function getBrandPrimary() {
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-primary')
        .trim()
        .toLowerCase();
}

export function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

export function normalizeHex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
}

export function getOrderedCategories(restaurant, items) {
    const categories = new Set((items || []).map((item) => item.category).filter(Boolean));
    (restaurant?.category_order || []).forEach((category) => categories.add(category));
    const order = restaurant?.category_order || [];

    return Array.from(categories).sort((categoryA, categoryB) => {
        const indexA = order.indexOf(categoryA);
        const indexB = order.indexOf(categoryB);
        return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA)
            - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
    });
}

export function getItemsForCategory(items, category) {
    return (items || [])
        .filter((item) => item.category === category)
        .sort((itemA, itemB) => String(itemA.name || '').localeCompare(String(itemB.name || ''), 'pt'));
}

function isDarkColor(value) {
    const color = normalizeHex(value, THEME_DEFAULTS.background).slice(1);
    const red = Number.parseInt(color.slice(0, 2), 16);
    const green = Number.parseInt(color.slice(2, 4), 16);
    const blue = Number.parseInt(color.slice(4, 6), 16);
    return ((red * 299) + (green * 587) + (blue * 114)) / 1000 < 145;
}

function getFontFallback(font) {
    if (/playfair|lora|merriweather|slab/i.test(font)) return 'serif';
    if (/dancing/i.test(font)) return 'cursive';
    return 'sans-serif';
}

function loadMenuFont(font, linkId) {
    let link = document.getElementById(linkId);
    if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700;800&display=swap`;
}

export function applyMenuTheme(root, restaurant, options = {}) {
    if (!root || !restaurant) return;

    const font = restaurant.font || 'Outfit';
    const fontFamily = `'${font}', ${getFontFallback(font)}`;
    const background = normalizeHex(restaurant.color_background, THEME_DEFAULTS.background);
    const dark = isDarkColor(background);
    const primary = normalizeHex(restaurant.color_primary, getBrandPrimary());
    const text = normalizeHex(restaurant.color_text, dark ? '#ffffff' : THEME_DEFAULTS.text);
    const textSecondary = normalizeHex(
        restaurant.color_text_secondary,
        dark ? '#a0a0a0' : THEME_DEFAULTS.textSecondary,
    );

    loadMenuFont(font, options.fontLinkId || 'menuFontLink');
    root.style.fontFamily = fontFamily;
    root.style.setProperty('--font', fontFamily);
    root.style.setProperty('--font-heading', fontFamily);
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--text', text);
    root.style.setProperty('--text-muted', textSecondary);
    root.style.setProperty('--bg-mobile', background);
    root.style.setProperty('--bg-card', dark ? '#252525' : '#ffffff');
    root.style.setProperty('--bg-badge', dark ? '#333333' : '#ebebeb');
    root.style.setProperty('--border', dark ? '#333333' : '#f0f0f0');
    root.style.setProperty('--item-divider', dark ? '#3a3a3c' : '#d2d2d7');

    if (options.updatePageBackground) {
        root.style.setProperty('--bg-page', dark ? '#121212' : '#eaeaea');
    }
}

function sanitizePhone(phone) {
    return String(phone || '').replace(/[^+\d]/g, '');
}

export function renderInfoBadgesMarkup(restaurant, options = {}) {
    const badges = [];
    const interactive = options.interactive === true;

    if (restaurant?.wifi_ssid || restaurant?.wifi_password) {
        const content = `
            <i class="fa-solid fa-wifi"></i>
            <span>${escapeHTML(restaurant.wifi_ssid || 'Wi-Fi')}</span>`;
        badges.push(interactive
            ? `<button class="info-badge" type="button" data-info-action="wifi">${content}</button>`
            : `<span class="info-badge">${content}</span>`);
    }

    if (restaurant?.phone) {
        const content = `
            <i class="fa-solid fa-phone"></i>
            <span>${escapeHTML(restaurant.phone)}</span>`;
        badges.push(interactive
            ? `<a class="info-badge" href="tel:${escapeHTML(sanitizePhone(restaurant.phone))}">${content}</a>`
            : `<span class="info-badge">${content}</span>`);
    }

    return badges.join('');
}

function formatPrice(value) {
    const number = Number(value);
    return `${Number.isFinite(number) ? number.toFixed(2) : '0.00'}€`;
}

export function renderMenuItem(item, options = {}) {
    const imageUrl = item.image_url || ITEM_PLACEHOLDER_IMAGE;
    const imageClass = item.image_url ? 'item-img' : 'item-img item-img-placeholder';
    const actions = typeof options.actions === 'function' ? options.actions(item) : (options.actions || '');

    return `
        <article class="menu-item${item.available === false ? ' unavailable' : ''}"
            data-item-id="${escapeHTML(item.id)}">
            ${actions}
            <div class="item-text">
                <h3>${escapeHTML(item.name)}</h3>
                <p class="item-desc">${escapeHTML(item.description || '')}</p>
                <div class="item-price">${formatPrice(item.price)}</div>
            </div>
            <div class="${imageClass}">
                <img src="${escapeHTML(imageUrl)}" loading="lazy"
                    alt="${item.image_url ? escapeHTML(item.name) : 'Imagem indisponível'}">
            </div>
        </article>`;
}

export function renderItemsGrid(items, options = {}) {
    const visibleItems = options.includeUnavailable === false
        ? (items || []).filter((item) => item.available !== false)
        : (items || []);
    const itemsMarkup = visibleItems
        .map((item) => renderMenuItem(item, { actions: options.actions }))
        .join('');
    const afterItems = options.afterItems || '';
    const footer = options.footer === false
        ? ''
        : '<footer class="menu-footer"><p>Menu digital por <b>Menu no Ar</b></p></footer>';

    return `<div class="items-grid">${itemsMarkup}${afterItems}${footer}</div>`;
}

export function bindHorizontalTabDrag(tabs) {
    if (!tabs || tabs.dataset.dragBound === 'true') return;

    let isPointerDown = false;
    let isDragging = false;
    let suppressClick = false;
    let pointerId = null;
    let startX = 0;
    let startScrollLeft = 0;

    const stopDrag = (event) => {
        if (!isPointerDown || event.pointerId !== pointerId) return;
        isPointerDown = false;
        pointerId = null;
        if (isDragging) {
            suppressClick = true;
            window.setTimeout(() => {
                suppressClick = false;
            }, 0);
        }
        isDragging = false;
        tabs.classList.remove('is-dragging');
        if (tabs.hasPointerCapture?.(event.pointerId)) tabs.releasePointerCapture(event.pointerId);
    };

    tabs.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest('[data-no-tab-drag]')) return;
        isPointerDown = true;
        isDragging = false;
        pointerId = event.pointerId;
        startX = event.clientX;
        startScrollLeft = tabs.scrollLeft;
    });

    tabs.addEventListener('pointermove', (event) => {
        if (!isPointerDown || event.pointerId !== pointerId) return;
        const deltaX = startX - event.clientX;
        if (Math.abs(deltaX) < 4 && !isDragging) return;
        isDragging = true;
        tabs.classList.add('is-dragging');
        tabs.setPointerCapture?.(event.pointerId);
        tabs.scrollLeft = startScrollLeft + deltaX;
        event.preventDefault();
    });

    tabs.addEventListener('pointerup', stopDrag);
    tabs.addEventListener('pointercancel', stopDrag);
    tabs.addEventListener('click', (event) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
    tabs.dataset.dragBound = 'true';
}
