import {
    applyMenuTheme,
    bindHorizontalTabDrag,
    getItemsForCategory,
    getOrderedCategories,
    renderInfoBadgesMarkup,
    renderItemsGrid,
} from './menu-view.js';

let currentRestaurant = null;
let currentCategoryIndex = 0;
let slideObserver = null;

const qs = (id) => document.getElementById(id);

function showError(message) {
    const loading = qs('loading');
    if (!loading) return;
    const menu = qs('mobile-view');
    if (menu) menu.hidden = true;
    loading.innerHTML = `<p class="menu-error-message">${message}</p>`;
}

function renderHeader(restaurant) {
    document.title = restaurant.name || 'Menu Digital';
    qs('restName').textContent = restaurant.name || '';
    qs('restDesc').textContent = restaurant.description || '';

    const cover = qs('coverContainer');
    const hero = qs('heroHeader');
    if (restaurant.cover_url) {
        cover.style.display = 'block';
        cover.style.backgroundImage = `url('${restaurant.cover_url}')`;
        hero.style.paddingTop = '';
    } else {
        cover.style.display = 'none';
        cover.style.backgroundImage = '';
        hero.style.paddingTop = '100px';
    }

    const badges = qs('infoBadges');
    badges.innerHTML = renderInfoBadgesMarkup(restaurant, { interactive: true });
    badges.querySelector('[data-info-action="wifi"]')?.addEventListener('click', () => {
        if (!restaurant.wifi_password) return;
        window.alert(`Rede: ${restaurant.wifi_ssid || 'Wi-Fi'}\nPassword: ${restaurant.wifi_password}`);
    });
}

function switchToCategory(index, options = {}) {
    const track = qs('menuSliderTrack');
    const tabs = Array.from(qs('categoryTabs')?.querySelectorAll('.tab-btn') || []);
    if (!track?.children.length) return;

    currentCategoryIndex = Math.max(0, Math.min(index, track.children.length - 1));
    track.style.transition = options.instant ? 'none' : '';
    track.style.transform = `translateX(-${currentCategoryIndex * 100}%)`;

    tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === currentCategoryIndex;
        tab.classList.toggle('active', active);
        if (active && !options.instant) {
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });

    const windowElement = qs('menuSliderWindow');
    const currentSlide = track.children[currentCategoryIndex];
    if (!currentSlide || !windowElement) return;

    windowElement.scrollTop = 0;
    track.style.height = `${currentSlide.offsetHeight}px`;
    slideObserver?.disconnect();
    slideObserver = new ResizeObserver(([entry]) => {
        track.style.height = `${entry.target.offsetHeight}px`;
    });
    slideObserver.observe(currentSlide);

    if (options.instant) requestAnimationFrame(() => {
        track.style.transition = '';
    });
}

function renderMenu(restaurant, items) {
    const categories = getOrderedCategories(restaurant, items)
        .filter((category) => getItemsForCategory(items, category)
            .some((item) => item.available !== false));
    const tabs = qs('categoryTabs');
    const track = qs('menuSliderTrack');
    tabs.innerHTML = '';
    track.innerHTML = '';

    if (!categories.length) {
        tabs.hidden = true;
        track.innerHTML = `
            <section class="menu-slide menu-empty-state">
                <p>Este menu ainda não tem pratos.</p>
                <footer class="menu-footer"><p>Menu digital por <b>Menu no Ar</b></p></footer>
            </section>`;
        return;
    }

    tabs.hidden = false;
    bindHorizontalTabDrag(tabs);

    categories.forEach((category, index) => {
        const tab = document.createElement('button');
        tab.className = `tab-btn${index === 0 ? ' active' : ''}`;
        tab.type = 'button';
        tab.textContent = category;
        tab.addEventListener('click', () => switchToCategory(index));
        tabs.appendChild(tab);

        const slide = document.createElement('section');
        slide.className = 'menu-slide';
        slide.dataset.category = category;
        slide.innerHTML = `
            <div class="slide-content">
                ${renderItemsGrid(getItemsForCategory(items, category), { includeUnavailable: false })}
            </div>`;
        track.appendChild(slide);
    });

    requestAnimationFrame(() => switchToCategory(0, { instant: true }));
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (window['pdfjs-dist/build/pdf']) resolve();
            else existing.addEventListener('load', resolve, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.addEventListener('load', resolve, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });
}

async function renderPdfMenu(restaurant) {
    document.body.className = 'pdf-menu-page';
    document.body.innerHTML = `
        <div id="pdf-reels-container" class="pdf-reels-container">
            <div id="pdfLoading" class="pdf-loading">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>A preparar menu...</p>
            </div>
        </div>`;

    try {
        const src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        await loadScript(src);
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(restaurant.pdf_url).promise;
        const container = qs('pdf-reels-container');
        qs('pdfLoading').remove();

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const wrapper = document.createElement('section');
            wrapper.className = 'pdf-page';
            const canvas = document.createElement('canvas');
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);

            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 2 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            canvas.classList.add('is-ready');

            if (pageNumber === pdf.numPages) {
                const credit = document.createElement('a');
                credit.className = 'pdf-credit';
                credit.href = 'https://menunoar.pt';
                credit.target = '_blank';
                credit.rel = 'noreferrer';
                credit.innerHTML = 'Feito com <b>menunoar.pt</b>';
                wrapper.appendChild(credit);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar PDF:', error);
        const loading = qs('pdfLoading');
        if (loading) loading.innerHTML = '<p>Não foi possível carregar este menu.</p>';
    }
}

function bindPreviewUpdates() {
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin || !currentRestaurant) return;
        const { type, data } = event.data || {};

        if (type === 'previewUpdate' && data) {
            Object.assign(currentRestaurant, data);
            applyMenuTheme(document.documentElement, currentRestaurant, {
                fontLinkId: 'publicMenuFontLink',
                updatePageBackground: true,
            });
            renderHeader(currentRestaurant);
        } else if (type === 'previewUpdateCover') {
            currentRestaurant.cover_url = data || null;
            renderHeader(currentRestaurant);
        }
    });
}

async function init() {
    bindPreviewUpdates();

    try {
        const slug = new URLSearchParams(window.location.search).get('id');
        if (!slug) {
            showError('Restaurante não encontrado.');
            return;
        }

        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Configuração indisponível');
        const config = await response.json();

        const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        const { data: restaurant, error: restaurantError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (restaurantError || !restaurant) {
            showError('404 - Restaurante não encontrado.');
            return;
        }

        currentRestaurant = restaurant;
        if (restaurant.menu_type === 'pdf' && restaurant.pdf_url) {
            await renderPdfMenu(restaurant);
            return;
        }

        const { data: items, error: itemsError } = await supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurant.id)
            .order('category')
            .order('name');

        if (itemsError) throw itemsError;

        applyMenuTheme(document.documentElement, restaurant, {
            fontLinkId: 'publicMenuFontLink',
            updatePageBackground: true,
        });
        renderHeader(restaurant);
        renderMenu(restaurant, items || []);
        qs('loading').hidden = true;
    } catch (error) {
        console.error('Erro ao carregar menu:', error);
        showError('Não foi possível carregar este menu. Tenta novamente.');
    }
}

init();
