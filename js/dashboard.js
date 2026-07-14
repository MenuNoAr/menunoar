import { getSupabase, initAuthListener, signOut } from './auth-service.js';
import { initUploadService, uploadFile } from './upload-service.js';
import {
    applyMenuTheme,
    bindHorizontalTabDrag,
    escapeHTML,
    getBrandPrimary,
    getItemsForCategory,
    getOrderedCategories,
    ITEM_PLACEHOLDER_IMAGE,
    normalizeHex,
    renderInfoBadgesMarkup,
    renderItemsGrid,
    renderRestaurantLogo,
} from './menu-view.js';

const app = {
    supabase: null,
    user: null,
    restaurant: null,
    items: [],
    activeCategory: null,
};

let authBootstrappedForUser = null;
const COVER_PLACEHOLDER_IMAGE = 'assets/images/cover-placeholder.svg';
const QR_ICON_SIZE = 260;
const IMAGE_CROP_CONFIG = {
    cover: {
        aspect: 16 / 9,
        width: 1600,
        height: 900,
        kicker: 'Capa',
        title: 'Recortar capa',
        fileName: 'cover-crop.jpg',
    },
    item: {
        aspect: 1,
        width: 1200,
        height: 1200,
        kicker: 'Prato',
        title: 'Recortar imagem do prato',
        fileName: 'item-crop.jpg',
    },
    logo: {
        aspect: 1,
        width: 1000,
        height: 1000,
        kicker: 'Logótipo',
        title: 'Recortar logótipo',
        fileName: 'logo-crop.jpg',
    },
};
const FONT_OPTIONS = [
    'Outfit',
    'Inter',
    'Poppins',
    'Montserrat',
    'Lora',
    'Playfair Display',
    'Merriweather',
    'Roboto Slab',
    'Oswald',
    'Dancing Script',
];
const APPEARANCE_FIELDS = ['color_background', 'color_text', 'color_text_secondary', 'color_primary'];
const STARTER_COVER_IMAGE = 'assets/images/starter-cover.svg';
const STARTER_CATEGORIES = ['Pratos', 'Sobremesas'];
const STARTER_ITEMS = [
    {
        category: 'Pratos',
        name: 'Prato do dia',
        description: 'Uma sugestão preparada com ingredientes da época.',
        price: 12.5,
    },
    {
        category: 'Pratos',
        name: 'Opção vegetariana',
        description: 'Uma alternativa leve, fresca e cheia de sabor.',
        price: 10.5,
    },
    {
        category: 'Sobremesas',
        name: 'Mousse de chocolate',
        description: 'Cremosa, intensa e feita na casa.',
        price: 4.5,
    },
    {
        category: 'Sobremesas',
        name: 'Cheesecake da casa',
        description: 'Base crocante, creme suave e fruta da estação.',
        price: 5,
    },
];
const CREATION_LOADING_MESSAGES = [
    'A preparar o template',
    'A criar as categorias',
    'A adicionar os primeiros pratos',
    'A finalizar os detalhes',
];
const TUTORIAL_STEPS = [
    {
        targets: ['[data-action="open-hero-modal"]'],
        title: 'Editar restaurante',
        text: 'Usa este lapis para alterar nome, descricao, logotipo, Wi-Fi e telefone do menu.',
    },
    {
        targets: ['#editCoverBtn', '[data-action="open-hero-modal"]'],
        title: 'Adicionar capa',
        text: 'Carrega no lapis da capa para trocar o banner. Se ainda nao existir capa, podes adiciona-la no modal do restaurante.',
    },
    {
        targets: ['[data-action="open-categories-modal"]', '.empty-menu [data-action="open-categories-modal"]'],
        title: 'Criar categorias',
        text: 'Este lapis abre a organizacao das categorias, onde podes criar, editar, apagar e ordenar seccoes.',
    },
    {
        targets: ['[data-action="add-item"]', '[data-action="open-categories-modal"]'],
        title: 'Criar pratos',
        text: 'O botao mais adiciona um prato dentro da categoria ativa. Se ainda nao aparecer, cria primeiro uma categoria.',
    },
    {
        targets: ['[data-action="edit-item"]', '[data-action="add-item"]'],
        title: 'Editar pratos',
        text: 'O lapis em cada prato abre o modal para alterar nome, descricao, preco, imagem e disponibilidade.',
    },
    {
        targets: ['[data-action="delete-item"]', '[data-action="edit-item"]'],
        title: 'Apagar pratos',
        text: 'O caixote remove pratos que ja nao queres mostrar, sempre com confirmacao antes de apagar.',
    },
    {
        target: '#openAppearanceBtn',
        title: 'Cores do menu',
        text: 'Aqui ajustas fundo, texto principal, texto secundario e destaque do menu em tempo real.',
    },
    {
        target: '#openFontBtn',
        title: 'Fonte global',
        text: 'Escolhe a fonte aplicada ao menu publico e ao preview do dashboard.',
    },
    {
        target: '#openQrBtn',
        title: 'QR Code',
        text: 'Gera o QR do menu, escolhe a cor e descarrega em PNG ou PDF.',
    },
    {
        target: '#openLiveBtn',
        title: 'Menu real',
        text: 'Abre o URL publico para confirmares a versao final como o cliente ve.',
    },
    {
        target: '#deleteRestaurantBtn',
        title: 'Eliminar restaurante',
        text: 'O caixote apaga o menu completo. Para evitar acidentes, tens de escrever o nome do restaurante antes de confirmar.',
    },
    {
        target: '#logoutBtn',
        title: 'Sair',
        text: 'Termina a sessao desta conta com seguranca.',
    },
];
let qrCode = null;
let qrColor = '#111111';
let appearanceSaveTimer = null;
let fontSaveTimer = null;
let saveStatusTimer = null;
let tutorialOpen = false;
let tutorialStepIndex = 0;
let cropState = null;
let pendingItemImageFile = null;
let pendingItemImagePreviewUrl = null;
let creationLoadingTimer = null;
let creationLoadingStartedAt = 0;

function qs(id) {
    return document.getElementById(id);
}

function setCreationLoadingMessage(index) {
    const message = qs('creationLoadingMessage');
    if (!message) return;
    message.textContent = CREATION_LOADING_MESSAGES[index % CREATION_LOADING_MESSAGES.length];
}

function showCreationLoading() {
    const loading = qs('creationLoading');
    if (!loading) return;
    window.clearInterval(creationLoadingTimer);
    creationLoadingStartedAt = Date.now();
    setCreationLoadingMessage(0);
    loading.hidden = false;

    let messageIndex = 1;
    creationLoadingTimer = window.setInterval(() => {
        setCreationLoadingMessage(messageIndex);
        messageIndex += 1;
    }, 1150);
}

async function hideCreationLoading() {
    const loading = qs('creationLoading');
    const elapsed = Date.now() - creationLoadingStartedAt;
    const remaining = Math.max(0, 850 - elapsed);
    if (remaining) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
    }
    window.clearInterval(creationLoadingTimer);
    creationLoadingTimer = null;
    if (loading) loading.hidden = true;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function getLiveMenuUrl() {
    const slug = app.restaurant?.slug || '';
    return `${window.location.origin}/menu.html?id=${encodeURIComponent(slug)}`;
}

async function updateRestaurant(updates) {
    const columns = Object.keys(updates);
    if (!app.supabase || !app.restaurant || !columns.length) {
        return { data: null, error: new Error('Restaurante indisponível.') };
    }

    const { data, error } = await app.supabase
        .from('restaurants')
        .update(updates)
        .eq('id', app.restaurant.id)
        .select(columns.join(','))
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: new Error('A alteração não foi aplicada.') };

    Object.assign(app.restaurant, data);
    return { data, error: null };
}

function getGoogleFontHref(fonts) {
    const families = fonts
        .map((font) => `family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700`)
        .join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function loadFontOptions() {
    let fontLink = qs('dashboardFontOptionsLink');
    if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = 'dashboardFontOptionsLink';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
    }
    fontLink.href = getGoogleFontHref(FONT_OPTIONS);
}

function setSaveStatus(text, reset = false) {
    const status = qs('saveStatus');
    if (!status) return;

    window.clearTimeout(saveStatusTimer);
    status.textContent = text;
    status.hidden = false;
    status.classList.toggle('is-error', /não|nao|erro|falhou/i.test(text));
    requestAnimationFrame(() => status.classList.add('is-visible'));

    if (reset) {
        saveStatusTimer = window.setTimeout(() => {
            status.classList.remove('is-visible');
            window.setTimeout(() => {
                status.hidden = true;
            }, 180);
        }, 1700);
    }
}

function getCropConfig(mode) {
    return IMAGE_CROP_CONFIG[mode] || IMAGE_CROP_CONFIG.item;
}

function applyCropTransform() {
    if (!cropState) return;
    const image = qs('cropImage');
    if (!image) return;

    image.style.width = `${cropState.naturalWidth * cropState.scale}px`;
    image.style.height = `${cropState.naturalHeight * cropState.scale}px`;
    image.style.transform = `translate3d(${cropState.offsetX}px, ${cropState.offsetY}px, 0)`;
}

function constrainCropOffset() {
    if (!cropState) return;
    const displayWidth = cropState.naturalWidth * cropState.scale;
    const displayHeight = cropState.naturalHeight * cropState.scale;

    cropState.offsetX = displayWidth <= cropState.frameWidth
        ? (cropState.frameWidth - displayWidth) / 2
        : clamp(cropState.offsetX, cropState.frameWidth - displayWidth, 0);
    cropState.offsetY = displayHeight <= cropState.frameHeight
        ? (cropState.frameHeight - displayHeight) / 2
        : clamp(cropState.offsetY, cropState.frameHeight - displayHeight, 0);
}

function initCropGeometry(preserveCenter = false) {
    if (!cropState) return;
    const frame = qs('cropFrame');
    const zoomInput = qs('cropZoomInput');
    if (!frame || !zoomInput) return;

    const centerX = cropState.scale
        ? (cropState.frameWidth / 2 - cropState.offsetX) / cropState.scale
        : null;
    const centerY = cropState.scale
        ? (cropState.frameHeight / 2 - cropState.offsetY) / cropState.scale
        : null;
    const rect = frame.getBoundingClientRect();
    cropState.frameWidth = rect.width;
    cropState.frameHeight = rect.height;
    cropState.minScale = Math.max(
        cropState.frameWidth / cropState.naturalWidth,
        cropState.frameHeight / cropState.naturalHeight
    );
    cropState.zoom = Number(zoomInput.value) || 1;
    cropState.scale = cropState.minScale * cropState.zoom;
    cropState.offsetX = preserveCenter && centerX !== null
        ? cropState.frameWidth / 2 - centerX * cropState.scale
        : (cropState.frameWidth - (cropState.naturalWidth * cropState.scale)) / 2;
    cropState.offsetY = preserveCenter && centerY !== null
        ? cropState.frameHeight / 2 - centerY * cropState.scale
        : (cropState.frameHeight - (cropState.naturalHeight * cropState.scale)) / 2;
    constrainCropOffset();
    applyCropTransform();
}

function closeImageCropper(result = null) {
    if (!cropState) return;
    const state = cropState;
    const image = qs('cropImage');

    qs('imageCropModal').hidden = true;
    if (image) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute('src');
        image.style.transform = '';
        image.style.width = '';
        image.style.height = '';
    }
    if (state.url) URL.revokeObjectURL(state.url);
    cropState = null;
    state.resolve(result);
}

function clearPendingItemImage() {
    pendingItemImageFile = null;
    if (pendingItemImagePreviewUrl) {
        URL.revokeObjectURL(pendingItemImagePreviewUrl);
        pendingItemImagePreviewUrl = null;
    }
}

function openImageCropper(file, mode) {
    if (!file?.type?.startsWith('image/')) {
        setSaveStatus('Escolhe uma imagem valida');
        return Promise.resolve(null);
    }
    if (tutorialOpen) closeTutorial();

    return new Promise((resolve) => {
        const modal = qs('imageCropModal');
        const image = qs('cropImage');
        const frame = qs('cropFrame');
        const zoomInput = qs('cropZoomInput');
        const config = getCropConfig(mode);
        if (!modal || !image || !frame || !zoomInput) {
            resolve(file);
            return;
        }

        const url = URL.createObjectURL(file);
        cropState = {
            file,
            mode,
            config,
            url,
            resolve,
            naturalWidth: 1,
            naturalHeight: 1,
            frameWidth: 1,
            frameHeight: 1,
            minScale: 1,
            scale: 1,
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
            dragging: false,
        };

        qs('cropModalKicker').textContent = config.kicker;
        qs('cropModalTitle').textContent = config.title;
        frame.dataset.mode = mode;
        zoomInput.value = '1';

        image.onload = () => {
            if (!cropState) return;
            cropState.naturalWidth = image.naturalWidth;
            cropState.naturalHeight = image.naturalHeight;
            modal.hidden = false;
            window.requestAnimationFrame(initCropGeometry);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            cropState = null;
            setSaveStatus('Nao foi possivel abrir a imagem');
            resolve(null);
        };
        image.src = url;
    });
}

function updateCropZoom(event) {
    if (!cropState) return;
    const nextZoom = Number(event.target.value) || 1;
    const centerX = (cropState.frameWidth / 2 - cropState.offsetX) / cropState.scale;
    const centerY = (cropState.frameHeight / 2 - cropState.offsetY) / cropState.scale;

    cropState.zoom = nextZoom;
    cropState.scale = cropState.minScale * cropState.zoom;
    cropState.offsetX = cropState.frameWidth / 2 - centerX * cropState.scale;
    cropState.offsetY = cropState.frameHeight / 2 - centerY * cropState.scale;
    constrainCropOffset();
    applyCropTransform();
}

function startCropDrag(event) {
    if (!cropState) return;
    event.preventDefault();
    cropState.dragging = true;
    cropState.pointerId = event.pointerId;
    cropState.startX = event.clientX;
    cropState.startY = event.clientY;
    cropState.startOffsetX = cropState.offsetX;
    cropState.startOffsetY = cropState.offsetY;
    qs('cropFrame')?.setPointerCapture(event.pointerId);
}

function moveCropDrag(event) {
    if (!cropState?.dragging || cropState.pointerId !== event.pointerId) return;
    event.preventDefault();
    cropState.offsetX = cropState.startOffsetX + event.clientX - cropState.startX;
    cropState.offsetY = cropState.startOffsetY + event.clientY - cropState.startY;
    constrainCropOffset();
    applyCropTransform();
}

function stopCropDrag(event) {
    if (!cropState?.dragging || cropState.pointerId !== event.pointerId) return;
    cropState.dragging = false;
    qs('cropFrame')?.releasePointerCapture(event.pointerId);
}

function createCroppedImageFile() {
    return new Promise((resolve) => {
        if (!cropState) {
            resolve(null);
            return;
        }

        const image = qs('cropImage');
        const { config } = cropState;
        const canvas = document.createElement('canvas');
        canvas.width = config.width;
        canvas.height = config.height;

        const sourceX = -cropState.offsetX / cropState.scale;
        const sourceY = -cropState.offsetY / cropState.scale;
        const sourceWidth = cropState.frameWidth / cropState.scale;
        const sourceHeight = cropState.frameHeight / cropState.scale;
        const context = canvas.getContext('2d');
        context.drawImage(
            image,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            config.width,
            config.height
        );

        canvas.toBlob((blob) => {
            if (!blob) {
                resolve(null);
                return;
            }
            resolve(new File([blob], config.fileName, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
    });
}

async function confirmCropSelection() {
    if (!cropState) return;
    const button = qs('confirmCropBtn');
    if (button) button.disabled = true;
    const file = await createCroppedImageFile();
    if (button) button.disabled = false;
    closeImageCropper(file);
}

function pickCroppedImage(mode) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            resolve(file ? await openImageCropper(file, mode) : null);
        }, { once: true });
        input.click();
    });
}

function selectCategoryTab(tab) {
    if (!tab?.dataset?.category) return;
    app.activeCategory = tab.dataset.category;
    renderDashboard();
}

function getTutorialTargets() {
    return TUTORIAL_STEPS
        .map((step) => {
            const selectors = step.targets || [step.target];
            const element = selectors
                .map((selector) => document.querySelector(selector))
                .find((candidate) => {
                    if (!candidate) return false;
                    const rect = candidate.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                });
            const target = selectors.find((selector) => document.querySelector(selector) === element);
            return { ...step, target, element };
        })
        .filter((step) => step.element);
}

function clearTutorialHighlights() {
    document.querySelectorAll('[aria-describedby="tutorialActiveCard"]').forEach((element) => {
        element.removeAttribute('aria-describedby');
    });
    const highlight = qs('tutorialTargetHighlight');
    if (highlight) highlight.hidden = true;
}

function getTutorialDots(total) {
    return Array.from({ length: total }, (_, index) => `
        <span class="tutorial-dot${index === tutorialStepIndex ? ' is-active' : ''}" aria-hidden="true"></span>
    `).join('');
}

function positionTutorialCard() {
    const card = qs('tutorialCards')?.querySelector('.tutorial-card');
    if (!card) return;

    const target = document.querySelector(card.dataset.target);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const highlight = qs('tutorialTargetHighlight');
    if (highlight) {
        const highlightGap = 5;
        const targetRadius = Number.parseFloat(window.getComputedStyle(target).borderRadius) || 8;
        highlight.style.left = `${rect.left - highlightGap}px`;
        highlight.style.top = `${rect.top - highlightGap}px`;
        highlight.style.width = `${rect.width + (highlightGap * 2)}px`;
        highlight.style.height = `${rect.height + (highlightGap * 2)}px`;
        highlight.style.borderRadius = `${targetRadius + highlightGap}px`;
        highlight.hidden = false;
    }

    const margin = 14;
    const edge = 14;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const isMobile = window.matchMedia('(max-width: 680px)').matches;
    let placement = 'right';
    let left = rect.right + margin;
    let top = rect.top + (rect.height / 2) - (cardHeight / 2);

    if (isMobile) {
        placement = 'below';
        left = rect.left + (rect.width / 2) - (cardWidth / 2);
        top = rect.bottom + margin;
        if (top + cardHeight > window.innerHeight - edge) {
            placement = 'above';
            top = rect.top - cardHeight - margin;
        }
    } else if (left + cardWidth > window.innerWidth - edge) {
        placement = 'left';
        left = rect.left - cardWidth - margin;
        if (left < edge) {
            placement = 'below';
            left = rect.left + (rect.width / 2) - (cardWidth / 2);
            top = rect.bottom + margin;
        }
    }

    const finalLeft = clamp(left, edge, window.innerWidth - cardWidth - edge);
    const finalTop = clamp(top, edge, window.innerHeight - cardHeight - edge);
    const arrowTop = clamp(rect.top + (rect.height / 2) - finalTop, 18, cardHeight - 18);
    const arrowLeft = clamp(rect.left + (rect.width / 2) - finalLeft, 18, cardWidth - 18);

    card.dataset.placement = placement;
    card.style.left = `${finalLeft}px`;
    card.style.top = `${finalTop}px`;
    card.style.setProperty('--tutorial-arrow-top', `${arrowTop}px`);
    card.style.setProperty('--tutorial-arrow-left', `${arrowLeft}px`);
}

function renderTutorialStep(index = tutorialStepIndex) {
    const overlay = qs('tutorialOverlay');
    const cards = qs('tutorialCards');
    if (!overlay || !cards) return;

    clearTutorialHighlights();
    const steps = getTutorialTargets();
    if (!steps.length) return;

    tutorialStepIndex = clamp(index, 0, steps.length - 1);
    const step = steps[tutorialStepIndex];
    const isLastStep = tutorialStepIndex === steps.length - 1;

    cards.innerHTML = `
        <article id="tutorialActiveCard" class="tutorial-card" data-target="${escapeHTML(step.target)}"
            data-placement="right">
            <div class="tutorial-step-meta">
                <span>Passo ${tutorialStepIndex + 1} de ${steps.length}</span>
                <div class="tutorial-dots" aria-hidden="true">${getTutorialDots(steps.length)}</div>
            </div>
            <strong>${escapeHTML(step.title)}</strong>
            <p>${escapeHTML(step.text)}</p>
            <div class="tutorial-actions">
                <button class="tutorial-btn tutorial-btn-ghost" type="button" data-tutorial-action="prev"
                    ${tutorialStepIndex === 0 ? 'disabled' : ''}>Anterior</button>
                <button class="tutorial-btn tutorial-btn-primary" type="button" data-tutorial-action="next">
                    ${isLastStep ? 'Terminar' : 'Seguinte'}
                </button>
            </div>
        </article>
    `;

    step.element.setAttribute('aria-describedby', 'tutorialActiveCard');
    overlay.hidden = false;
    tutorialOpen = true;
    step.element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    window.requestAnimationFrame(() => {
        positionTutorialCard();
        window.setTimeout(positionTutorialCard, 260);
        window.setTimeout(positionTutorialCard, 520);
    });
}

function openTutorial() {
    renderTutorialStep(0);
}

function closeTutorial() {
    const overlay = qs('tutorialOverlay');
    if (overlay) overlay.hidden = true;
    tutorialOpen = false;
    tutorialStepIndex = 0;
    clearTutorialHighlights();
}

function toggleTutorial() {
    if (tutorialOpen) {
        closeTutorial();
    } else {
        openTutorial();
    }
}

function moveTutorialStep(direction) {
    const steps = getTutorialTargets();
    const nextIndex = tutorialStepIndex + direction;
    if (direction > 0 && nextIndex >= steps.length) {
        closeTutorial();
        return;
    }
    renderTutorialStep(nextIndex);
}

function getCategories() {
    return getOrderedCategories(app.restaurant, app.items);
}

function itemsForCategory(category) {
    return getItemsForCategory(app.items, category);
}

function applyRestaurantTheme() {
    const editor = qs('mobile-view');
    const restaurant = app.restaurant;
    if (!editor || !restaurant) return;
    applyMenuTheme(editor, restaurant, { fontLinkId: 'restaurantFontLink' });
}

function openAppearanceModal() {
    if (!app.restaurant) return;
    const errorEl = qs('appearanceError');
    if (errorEl) errorEl.hidden = true;
    qs('colorBackgroundInput').value = normalizeHex(app.restaurant.color_background, '#ffffff');
    qs('colorTextInput').value = normalizeHex(app.restaurant.color_text, '#1d1d1f');
    qs('colorTextSecondaryInput').value = normalizeHex(app.restaurant.color_text_secondary, '#666666');
    qs('colorPrimaryInput').value = normalizeHex(app.restaurant.color_primary, getBrandPrimary());
    qs('appearanceModal').hidden = false;
}

function closeAppearanceModal() {
    qs('appearanceModal').hidden = true;
}

function canSaveAppearance() {
    const availableFields = APPEARANCE_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(app.restaurant, field));
    if (availableFields.length !== APPEARANCE_FIELDS.length) {
        const errorEl = qs('appearanceError');
        if (errorEl) {
            errorEl.textContent = 'As colunas de cores ainda nao existem no Supabase.';
            errorEl.hidden = false;
        }
        return false;
    }
    return true;
}

function readAppearanceValues() {
    return {
        color_background: qs('colorBackgroundInput').value,
        color_text: qs('colorTextInput').value,
        color_text_secondary: qs('colorTextSecondaryInput').value,
        color_primary: qs('colorPrimaryInput').value,
    };
}

function scheduleAppearanceSave() {
    if (!app.restaurant || !canSaveAppearance()) return;

    const errorEl = qs('appearanceError');
    if (errorEl) errorEl.hidden = true;

    const updates = readAppearanceValues();
    Object.assign(app.restaurant, updates);
    applyRestaurantTheme();

    window.clearTimeout(appearanceSaveTimer);
    setSaveStatus('A guardar cores...');
    appearanceSaveTimer = window.setTimeout(() => saveAppearanceValues(updates), 450);
}

async function saveAppearanceValues(updates) {
    const { error } = await updateRestaurant(updates);

    if (error) {
        const errorEl = qs('appearanceError');
        if (errorEl) {
            errorEl.textContent = error.message || 'Nao foi possivel guardar as cores.';
            errorEl.hidden = false;
        }
        return;
    }

    setSaveStatus('Cores guardadas', true);
}

function renderFontOptions() {
    const select = qs('fontSelect');
    if (!select) return;
    const currentFont = app.restaurant?.font || 'Outfit';
    const options = FONT_OPTIONS.includes(currentFont) ? FONT_OPTIONS : [currentFont, ...FONT_OPTIONS];
    select.innerHTML = options.map((font) => `
        <option value="${escapeHTML(font)}" style="font-family:'${escapeHTML(font)}', sans-serif">
            ${escapeHTML(font)}
        </option>
    `).join('');
    select.value = currentFont;
    updateFontPreview();
}

function updateFontPreview() {
    const font = qs('fontSelect')?.value || 'Outfit';
    const preview = qs('fontPreview');
    if (preview) preview.style.fontFamily = `'${font}', sans-serif`;
    const select = qs('fontSelect');
    if (select) select.style.fontFamily = `'${font}', sans-serif`;
}

function scheduleFontSave() {
    if (!app.restaurant) return;

    const font = qs('fontSelect').value || 'Outfit';
    updateFontPreview();
    app.restaurant.font = font;
    applyRestaurantTheme();

    window.clearTimeout(fontSaveTimer);
    setSaveStatus('A guardar fonte...');
    fontSaveTimer = window.setTimeout(() => saveFontValue(font), 350);
}

function openFontModal() {
    if (!app.restaurant) return;
    loadFontOptions();
    renderFontOptions();
    qs('fontModal').hidden = false;
}

function closeFontModal() {
    qs('fontModal').hidden = true;
}

async function saveFontValue(font) {
    const { error } = await updateRestaurant({ font });

    if (error) {
        console.error(error);
        setSaveStatus('Nao foi possivel guardar');
        return;
    }

    setSaveStatus('Fonte guardada', true);
}

function openQrModal() {
    if (!app.restaurant) return;
    qrColor = normalizeHex(qs('qrColorInput')?.value, '#111111');
    qs('qrModal').hidden = false;
    renderQrCode();
}

function closeQrModal() {
    qs('qrModal').hidden = true;
}

function getQrOptions() {
    return {
        width: QR_ICON_SIZE,
        height: QR_ICON_SIZE,
        type: 'canvas',
        data: getLiveMenuUrl(),
        margin: 0,
        qrOptions: {
            errorCorrectionLevel: 'H',
        },
        dotsOptions: {
            color: qrColor,
            type: 'rounded',
        },
        cornersSquareOptions: {
            color: qrColor,
            type: 'extra-rounded',
        },
        cornersDotOptions: {
            color: qrColor,
        },
        backgroundOptions: {
            color: 'rgba(255,255,255,0)',
        },
    };
}

function renderQrCode() {
    const box = qs('qrCodeBox');
    if (!box) return;
    box.innerHTML = '';

    if (typeof window.QRCodeStyling === 'undefined') {
        box.textContent = 'QR indisponivel';
        return;
    }

    qrCode = new window.QRCodeStyling(getQrOptions());
    qrCode.append(box);
}

function getQrFileName() {
    return `menu-${slugify(app.restaurant?.slug || app.restaurant?.name || 'qrcode')}-qr`;
}

function downloadQrPng() {
    if (!qrCode) renderQrCode();
    qrCode?.download({ name: getQrFileName(), extension: 'png' });
}

function updateQrColor(value) {
    qrColor = normalizeHex(value, '#111111');
    if (qs('qrColorInput')) qs('qrColorInput').value = qrColor;
    renderQrCode();
}

async function downloadQrPdf() {
    if (!qrCode) renderQrCode();
    if (!qrCode || !window.jspdf?.jsPDF) return;
    const blob = await qrCode.getRawData('png');
    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
    const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [90, 90],
    });
    pdf.addImage(dataUrl, 'PNG', 12, 12, 66, 66);
    pdf.save(`${getQrFileName()}.pdf`);
}

function renderInfoBadges() {
    const container = qs('infoBadges');
    const restaurant = app.restaurant;
    if (!container || !restaurant) return;
    container.innerHTML = renderInfoBadgesMarkup(restaurant);
}

function renderCover() {
    const cover = qs('coverEditor');
    const placeholder = qs('coverPlaceholder');
    const removeButton = qs('removeCoverBtn');
    const hero = qs('heroHeader');
    if (!cover || !app.restaurant) return;

    const hasVisibleLogo = renderRestaurantLogo(cover, app.restaurant);
    if (app.restaurant.cover_url || hasVisibleLogo) {
        cover.style.display = 'block';
        cover.style.backgroundImage = app.restaurant.cover_url ? `url('${app.restaurant.cover_url}')` : '';
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundPosition = 'center';
        if (hero) hero.style.paddingTop = '';
        if (placeholder) placeholder.hidden = true;
        if (removeButton) removeButton.hidden = !app.restaurant.cover_url;
    } else {
        cover.style.backgroundImage = '';
        cover.style.display = 'none';
        if (hero) hero.style.paddingTop = '100px';
        if (placeholder) placeholder.hidden = false;
        if (removeButton) removeButton.hidden = true;
    }
}

function renderCategoryTabs(categories) {
    const tabs = qs('categoryTabs');
    if (!tabs) return;

    tabs.innerHTML = categories.map((category) => `
        <button class="tab-btn ${category === app.activeCategory ? 'active' : ''}" type="button"
            data-action="select-category" data-category="${escapeHTML(category)}">
            ${escapeHTML(category)}
        </button>
    `).join('');
}

function renderItemActions(item) {
    return `
        <div class="item-actions">
            <button class="item-edit-btn" type="button" data-action="edit-item" data-item-id="${escapeHTML(item.id)}"
                aria-label="Editar prato" title="Editar prato">
                <i class="fa-solid fa-pencil"></i>
            </button>
            <button class="item-delete-btn" type="button" data-action="delete-item" data-item-id="${escapeHTML(item.id)}"
                aria-label="Apagar prato" title="Apagar prato">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
}

function readRestaurantForm() {
    return {
        name: qs('heroNameInput').value.trim(),
        description: qs('heroDescInput').value.trim(),
        wifi_ssid: qs('heroWifiInput').value.trim(),
        wifi_password: qs('heroWifiPasswordInput').value.trim(),
        phone: qs('heroPhoneInput').value.trim(),
        logo_visible: qs('heroLogoVisibleInput').checked,
    };
}

function renderCategoriesModal() {
    const list = qs('categoriesList');
    if (!list) return;

    const categories = getCategories();
    list.innerHTML = categories.map((category, index) => `
        <div class="category-row" data-original-category="${escapeHTML(category)}">
            <input class="category-row-input" type="text" value="${escapeHTML(category)}" spellcheck="false">
            <div class="category-row-actions">
                <button class="row-icon-btn" type="button" data-action="category-row-move"
                    data-direction="-1" aria-label="Mover para cima" title="Mover para cima"
                    ${index === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="row-icon-btn" type="button" data-action="category-row-move"
                    data-direction="1" aria-label="Mover para baixo" title="Mover para baixo"
                    ${index === categories.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
                <button class="row-icon-btn row-icon-btn-danger" type="button"
                    data-action="category-row-delete" aria-label="Apagar categoria" title="Apagar categoria">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    updateCategoryModalControls();
}

function openHeroModal() {
    if (!app.restaurant) return;
    const errorEl = qs('heroError');
    if (errorEl) errorEl.hidden = true;
    qs('heroNameInput').value = app.restaurant.name || '';
    qs('heroDescInput').value = app.restaurant.description || '';
    qs('heroWifiInput').value = app.restaurant.wifi_ssid || '';
    qs('heroWifiPasswordInput').value = app.restaurant.wifi_password || '';
    qs('heroPhoneInput').value = app.restaurant.phone || '';
    setHeroModalCoverPreview();
    setHeroModalLogoPreview();
    qs('heroModal').hidden = false;
    window.setTimeout(() => qs('heroNameInput').focus(), 40);
}

function closeHeroModal() {
    qs('heroModal').hidden = true;
}

function setHeroModalCoverPreview() {
    const preview = qs('heroCoverPreviewImage');
    const previewContainer = qs('heroCoverPreview');
    const actionBtn = qs('heroCoverActionBtn');
    if (!preview) return;

    const coverUrl = app.restaurant?.cover_url || COVER_PLACEHOLDER_IMAGE;
    preview.src = coverUrl;
    preview.alt = app.restaurant?.cover_url ? 'Capa atual do restaurante' : 'Sem capa definida';
    if (previewContainer) previewContainer.dataset.hasCover = app.restaurant?.cover_url ? 'true' : 'false';
    if (actionBtn) {
        actionBtn.innerHTML = app.restaurant?.cover_url
            ? '<i class="fa-solid fa-trash"></i>'
            : '<i class="fa-solid fa-pencil"></i>';
        actionBtn.setAttribute('aria-label', app.restaurant?.cover_url ? 'Remover capa' : 'Alterar capa');
        actionBtn.title = app.restaurant?.cover_url ? 'Remover capa' : 'Alterar capa';
    }
}

function setHeroModalLogoPreview() {
    const previewButton = qs('heroLogoPreview');
    const previewImage = qs('heroLogoPreviewImage');
    const placeholder = qs('heroLogoPlaceholder');
    const visibleInput = qs('heroLogoVisibleInput');
    const removeButton = qs('heroLogoRemoveBtn');
    if (!previewButton || !previewImage || !placeholder || !visibleInput || !removeButton) return;

    const logoUrl = String(app.restaurant?.logo_url || '').trim();
    const hasLogo = Boolean(logoUrl);
    previewButton.dataset.hasLogo = hasLogo ? 'true' : 'false';
    previewButton.setAttribute('aria-label', hasLogo ? 'Alterar logótipo' : 'Adicionar logótipo');
    previewButton.title = hasLogo ? 'Alterar logótipo' : 'Adicionar logótipo';
    previewImage.hidden = !hasLogo;
    placeholder.hidden = hasLogo;
    removeButton.hidden = !hasLogo;
    visibleInput.disabled = !hasLogo;
    visibleInput.checked = app.restaurant?.logo_visible !== false;

    if (hasLogo) {
        previewImage.src = logoUrl;
        previewImage.alt = `Logótipo de ${app.restaurant?.name || 'restaurante'}`;
    } else {
        previewImage.removeAttribute('src');
        previewImage.alt = '';
    }
}

function openCategoriesModal() {
    renderCategoriesModal();
    qs('categoriesModal').hidden = false;
}

function closeCategoriesModal() {
    qs('categoriesModal').hidden = true;
}

function syncDeleteRestaurantButton() {
    const confirmationInput = qs('deleteRestaurantConfirmInput');
    const confirmButton = qs('confirmDeleteRestaurantBtn');
    if (!confirmationInput || !confirmButton) return;
    confirmButton.disabled = confirmationInput.value.trim() !== app.restaurant?.name;
}

function openDeleteRestaurantModal() {
    if (!app.restaurant) return;
    const modal = qs('deleteRestaurantModal');
    const confirmationInput = qs('deleteRestaurantConfirmInput');
    const errorElement = qs('deleteRestaurantError');
    qs('deleteRestaurantName').textContent = app.restaurant.name;
    confirmationInput.value = '';
    errorElement.hidden = true;
    syncDeleteRestaurantButton();
    modal.hidden = false;
    window.setTimeout(() => confirmationInput.focus(), 40);
}

async function removeRestaurantAssets() {
    const ownerFolder = app.user?.id;
    if (!ownerFolder) return null;

    const { data: files, error: listError } = await app.supabase.storage
        .from('menu-assets')
        .list(ownerFolder, { limit: 1000 });
    if (listError) return listError;

    const assetPaths = (files || [])
        .filter((file) => file.name && file.name !== '.emptyFolderPlaceholder')
        .map((file) => `${ownerFolder}/${file.name}`);
    if (!assetPaths.length) return null;

    const { error: removeError } = await app.supabase.storage
        .from('menu-assets')
        .remove(assetPaths);
    return removeError || null;
}

async function deleteRestaurant(event) {
    event.preventDefault();
    if (!app.supabase || !app.restaurant) return;

    const confirmationInput = qs('deleteRestaurantConfirmInput');
    const confirmButton = qs('confirmDeleteRestaurantBtn');
    const errorElement = qs('deleteRestaurantError');
    const restaurantName = app.restaurant.name;
    if (confirmationInput.value.trim() !== restaurantName) {
        errorElement.textContent = 'Escreve o nome do restaurante exatamente para confirmar.';
        errorElement.hidden = false;
        syncDeleteRestaurantButton();
        return;
    }

    confirmButton.disabled = true;
    errorElement.hidden = true;
    setSaveStatus('A eliminar restaurante...');

    const assetsError = await removeRestaurantAssets();
    if (assetsError) {
        console.error(assetsError);
        errorElement.textContent = 'Não foi possível eliminar as imagens do restaurante.';
        errorElement.hidden = false;
        syncDeleteRestaurantButton();
        return;
    }

    const { error } = await app.supabase
        .from('restaurants')
        .delete()
        .eq('id', app.restaurant.id);
    if (error) {
        console.error(error);
        errorElement.textContent = error.message || 'Não foi possível eliminar o restaurante.';
        errorElement.hidden = false;
        syncDeleteRestaurantButton();
        return;
    }

    app.restaurant = null;
    app.items = [];
    app.activeCategory = null;
    qs('deleteRestaurantModal').hidden = true;
    renderEmptyState();
    setSaveStatus('Restaurante eliminado', true);
}

function addCategoryRow(value = 'Nova categoria') {
    const list = qs('categoriesList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.originalCategory = '';
    row.innerHTML = `
        <input class="category-row-input" type="text" value="${escapeHTML(value)}" spellcheck="false">
        <div class="category-row-actions">
            <button class="row-icon-btn" type="button" data-action="category-row-move"
                data-direction="-1" aria-label="Mover para cima" title="Mover para cima">
                <i class="fa-solid fa-arrow-up"></i>
            </button>
            <button class="row-icon-btn" type="button" data-action="category-row-move"
                data-direction="1" aria-label="Mover para baixo" title="Mover para baixo">
                <i class="fa-solid fa-arrow-down"></i>
            </button>
            <button class="row-icon-btn row-icon-btn-danger" type="button"
                data-action="category-row-delete" aria-label="Apagar categoria" title="Apagar categoria">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
    list.appendChild(row);
    row.querySelector('input')?.focus();
    updateCategoryModalControls();
}

function updateCategoryModalControls() {
    const rows = Array.from(qs('categoriesList')?.querySelectorAll('.category-row') || []);
    rows.forEach((row, index) => {
        const up = row.querySelector('[data-direction="-1"]');
        const down = row.querySelector('[data-direction="1"]');
        if (up) up.disabled = index === 0;
        if (down) down.disabled = index === rows.length - 1;
    });
}

function moveCategoryRow(row, direction) {
    if (!row) return;
    const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) {
        row.parentNode.insertBefore(row, sibling);
    } else {
        row.parentNode.insertBefore(sibling, row);
    }
    updateCategoryModalControls();
}

function deleteCategoryRow(row) {
    row?.remove();
    updateCategoryModalControls();
}

async function saveHeroModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const updates = readRestaurantForm();
    const normalized = {};
    Object.entries(updates).forEach(([key, value]) => {
        normalized[key] = value;
    });

    const changed = Object.entries(normalized).some(([key, value]) => String(value || '') !== String(app.restaurant[key] || ''));
    if (!changed) {
        closeHeroModal();
        return;
    }

    setSaveStatus('A guardar restaurante...');
    const { error } = await updateRestaurant(normalized);

    if (error) {
        const errorEl = qs('heroError');
        if (errorEl) {
            errorEl.textContent = error.message || 'Nao foi possivel guardar o restaurante.';
            errorEl.hidden = false;
        }
        setSaveStatus('Nao foi possivel guardar');
        return;
    }

    renderDashboard();
    closeHeroModal();
    setSaveStatus('Restaurante guardado', true);
}

async function saveCategoriesModal(event) {
    event.preventDefault();
    if (!app.restaurant) return;

    const rows = Array.from(qs('categoriesList').querySelectorAll('.category-row')).map((row) => ({
        original: row.dataset.originalCategory || '',
        name: row.querySelector('.category-row-input')?.value.trim() || '',
    }));

    const names = rows.map((row) => row.name).filter(Boolean);
    if (!names.length) {
        setSaveStatus('Adiciona pelo menos uma categoria');
        return;
    }

    if (new Set(names).size !== names.length) {
        setSaveStatus('Não podem existir categorias repetidas');
        return;
    }

    const nextOrder = names;
    const nextImages = { ...(app.restaurant.category_images || {}) };
    const currentCategories = getCategories();
    const activeWasRenamed = rows.find((row) => row.original === app.activeCategory && row.name);
    const activeWasDeleted = app.activeCategory && !nextOrder.includes(app.activeCategory);

    setSaveStatus('A guardar categorias...');

    for (const row of rows) {
        if (!row.original || !row.name || row.original === row.name) continue;
        const { error } = await app.supabase
            .from('menu_items')
            .update({ category: row.name })
            .eq('restaurant_id', app.restaurant.id)
            .eq('category', row.original);
        if (error) {
            console.error(error);
            setSaveStatus('Não foi possível guardar');
            return;
        }
        if (nextImages[row.original]) {
            nextImages[row.name] = nextImages[row.original];
            delete nextImages[row.original];
        }
    }

    const deletedCategories = currentCategories.filter((category) => !nextOrder.includes(category));
    for (const category of deletedCategories) {
        const { error: deleteError } = await app.supabase
            .from('menu_items')
            .delete()
            .eq('restaurant_id', app.restaurant.id)
            .eq('category', category);
        if (deleteError) {
            console.error(deleteError);
            setSaveStatus('Não foi possível apagar a categoria');
            return;
        }
        delete nextImages[category];
    }

    const { error } = await updateRestaurant({
        category_order: nextOrder,
        category_images: nextImages,
    });

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    app.activeCategory = activeWasRenamed ? activeWasRenamed.name : (activeWasDeleted ? nextOrder[0] || null : app.activeCategory);
    closeCategoriesModal();
    await loadDashboardData();
    setSaveStatus('Categorias guardadas', true);
}

function renderActiveCategory(categories) {
    const editor = qs('categoryEditor');
    if (!editor) return;

    if (!categories.length || !app.activeCategory) {
        editor.innerHTML = `
            <div class="empty-menu">
                <p>O menu ainda não tem categorias.</p>
                <button type="button" data-action="open-categories-modal" aria-label="Abrir editor de categorias">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
        `;
        return;
    }

    const category = app.activeCategory;
    const items = itemsForCategory(category);
    const encodedCategory = encodeURIComponent(category);
    const addItemButton = `
        <button class="item-add" type="button" data-action="add-item" data-category="${encodedCategory}"
            aria-label="Adicionar prato" title="Adicionar prato">
            <i class="fa-solid fa-plus"></i>
        </button>`;

    editor.innerHTML = `
        <div class="slide-content">
            ${renderItemsGrid(items, {
                actions: renderItemActions,
                afterItems: addItemButton,
            })}
        </div>
    `;
}

function renderDashboard() {
    if (!app.restaurant) return;

    const categories = getCategories();
    if (!categories.includes(app.activeCategory)) {
        app.activeCategory = categories[0] || null;
    }

    qs('authLoading').hidden = true;
    qs('authError').hidden = true;
    qs('emptyState').hidden = true;
    qs('dashboardShell').hidden = false;

    applyRestaurantTheme();
    renderCover();
    renderInfoBadges();

    qs('restName').textContent = app.restaurant.name || '';
    qs('restDesc').textContent = app.restaurant.description || '';
    qs('openLiveBtn').href = getLiveMenuUrl();

    renderCategoryTabs(categories);
    renderActiveCategory(categories);
}

function renderEmptyState() {
    qs('authLoading').hidden = true;
    qs('dashboardShell').hidden = true;
    qs('emptyState').hidden = false;
}

async function createRestaurant(event) {
    event.preventDefault();
    if (!app.supabase || !app.user) return;

    const name = qs('createRestaurantName').value.trim();
    const errorElement = qs('createRestaurantError');
    const submitButton = qs('createRestaurantBtn');
    if (!name) return;

    errorElement.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = 'A criar...';
    showCreationLoading();

    const randomSuffix = window.crypto?.randomUUID?.().slice(0, 8)
        || Date.now().toString(36);
    const { data: restaurant, error: restaurantError } = await app.supabase
        .from('restaurants')
        .insert([{
            owner_id: app.user.id,
            name,
            slug: `${slugify(name) || 'menu'}-${randomSuffix}`,
            description: 'Bem-vindo ao nosso menu.',
            cover_url: STARTER_COVER_IMAGE,
            category_order: STARTER_CATEGORIES,
            color_primary: getBrandPrimary(),
        }])
        .select('*')
        .single();

    if (restaurantError || !restaurant) {
        console.error(restaurantError);
        await hideCreationLoading();
        qs('emptyState').hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = 'Criar menu';
        errorElement.textContent = restaurantError?.message || 'Não foi possível criar o menu.';
        errorElement.hidden = false;
        return;
    }

    const { data: items, error: itemsError } = await app.supabase
        .from('menu_items')
        .insert(STARTER_ITEMS.map((item) => ({
            ...item,
            restaurant_id: restaurant.id,
            available: true,
        })))
        .select('*');

    if (itemsError || !items) {
        console.error(itemsError);
        await app.supabase.from('restaurants').delete().eq('id', restaurant.id);
        await hideCreationLoading();
        qs('emptyState').hidden = false;
        submitButton.disabled = false;
        submitButton.textContent = 'Criar menu';
        errorElement.textContent = itemsError?.message || 'Não foi possível preparar os pratos iniciais.';
        errorElement.hidden = false;
        return;
    }

    app.restaurant = restaurant;
    app.items = items;
    app.activeCategory = STARTER_CATEGORIES[0];
    qs('emptyState').hidden = true;
    await hideCreationLoading();
    renderDashboard();
    setSaveStatus('Menu criado e pronto a editar', true);
}

async function loadDashboardData() {
    if (!app.supabase || !app.user) return;

    const { data: restaurant, error: restaurantError } = await app.supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', app.user.id)
        .maybeSingle();

    if (restaurantError) {
        console.error('Erro ao carregar restaurante:', restaurantError.message);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
        qs('dashboardShell').hidden = true;
        return;
    }

    if (!restaurant) {
        renderEmptyState();
        return;
    }

    const { data: items, error: itemsError } = await app.supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('category')
        .order('name');

    if (itemsError) console.error('Erro ao carregar pratos:', itemsError.message);

    app.restaurant = restaurant;
    app.items = items || [];
    renderDashboard();
}

function populateCategorySelect(selectedCategory) {
    const select = qs('itemCategoryInput');
    select.innerHTML = getCategories().map((category) =>
        `<option value="${escapeHTML(category)}" ${category === selectedCategory ? 'selected' : ''}>
            ${escapeHTML(category)}
        </option>`
    ).join('');
}

function setModalItemImage(item) {
    const preview = qs('itemModalImagePreview');
    const button = qs('itemModalImageBtn');
    if (!preview || !button) return;

    const hasItem = Boolean(item?.id);
    preview.src = pendingItemImagePreviewUrl || item?.image_url || ITEM_PLACEHOLDER_IMAGE;
    button.dataset.itemId = item?.id || '';
    button.disabled = false;
    button.title = hasItem
        ? 'Editar imagem do prato'
        : 'Adicionar imagem ao prato';
    button.setAttribute('aria-label', button.title);
}

function openItemModal(item = null, category = app.activeCategory) {
    clearPendingItemImage();
    qs('itemModalTitle').textContent = item ? 'Editar prato' : 'Adicionar prato';
    qs('itemIdInput').value = item?.id || '';
    qs('itemDeleteBtn').hidden = !item?.id;
    qs('itemNameInput').value = item?.name || '';
    qs('itemPriceInput').value = item ? Number(item.price || 0).toFixed(2) : '';
    qs('itemDescInput').value = item?.description || '';
    qs('itemAvailableInput').checked = item?.available !== false;
    populateCategorySelect(item?.category || category);
    setModalItemImage(item);
    qs('itemModal').hidden = false;
    window.setTimeout(() => qs('itemNameInput').focus(), 40);
}

function closeItemModal() {
    clearPendingItemImage();
    qs('itemModal').hidden = true;
}

async function saveItem(event) {
    event.preventDefault();
    const id = qs('itemIdInput').value;
    const price = Number.parseFloat(qs('itemPriceInput').value.replace(',', '.'));
    const payload = {
        name: qs('itemNameInput').value.trim(),
        description: qs('itemDescInput').value.trim(),
        category: qs('itemCategoryInput').value,
        price: Number.isNaN(price) ? 0 : price,
        available: qs('itemAvailableInput').checked,
    };

    if (!payload.name) return;
    setSaveStatus('A guardar prato...');

    let error;
    let savedItemId = id;
    let finalStatus = 'Prato guardado';
    if (id) {
        const result = await app.supabase
            .from('menu_items')
            .update(payload)
            .eq('id', id)
            .select('id')
            .maybeSingle();
        error = result.error || (result.data ? null : new Error('O prato não foi atualizado.'));
    } else {
        const result = await app.supabase.from('menu_items').insert([{
            ...payload,
            restaurant_id: app.restaurant.id,
        }]).select('id').single();
        error = result.error;
        savedItemId = result.data?.id;
    }

    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível guardar');
        return;
    }

    if (pendingItemImageFile && savedItemId) {
        setSaveStatus('A carregar imagem...');
        const { data, error: uploadError } = await uploadFile(pendingItemImageFile, `item-${savedItemId}`);
        if (uploadError || !data) {
            console.error(uploadError);
            finalStatus = 'Prato guardado, imagem não carregada';
        } else {
            const { error: imageUpdateError } = await app.supabase
                .from('menu_items')
                .update({ image_url: data.publicUrl })
                .eq('id', savedItemId);
            if (imageUpdateError) {
                console.error(imageUpdateError);
                finalStatus = 'Prato guardado, imagem não carregada';
            }
        }
    }

    app.activeCategory = payload.category;
    closeItemModal();
    await loadDashboardData();
    setSaveStatus(finalStatus, true);
}

async function deleteItem(id) {
    if (!window.confirm('Apagar este prato?')) return;
    const { error } = await app.supabase.from('menu_items').delete().eq('id', id);
    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível apagar o prato');
        return;
    }
    if (!qs('itemModal').hidden) closeItemModal();
    await loadDashboardData();
    setSaveStatus('Prato apagado', true);
}

async function uploadItemImage(id) {
    const file = await pickCroppedImage('item');
    if (!file) return;

    setSaveStatus('A carregar imagem...');
    const { data, error } = await uploadFile(file, `item-${id}`);
    if (error || !data) {
        console.error(error);
        setSaveStatus('Não foi possível carregar');
        return;
    }

    const { error: updateError } = await app.supabase
        .from('menu_items')
        .update({ image_url: data.publicUrl })
        .eq('id', id);
    if (updateError) {
        console.error(updateError);
        setSaveStatus('Não foi possível guardar a imagem');
        return;
    }
    await loadDashboardData();
    if (!qs('itemModal').hidden) {
        setModalItemImage(app.items.find((item) => String(item.id) === String(id)));
    }
    setSaveStatus('Imagem guardada', true);
}

async function prepareNewItemImage() {
    const file = await pickCroppedImage('item');
    if (!file) return;

    clearPendingItemImage();
    pendingItemImageFile = file;
    pendingItemImagePreviewUrl = URL.createObjectURL(file);
    qs('itemModalImagePreview').src = pendingItemImagePreviewUrl;
    setSaveStatus('Imagem pronta para guardar', true);
}

async function handleItemModalImageClick() {
    const itemId = qs('itemIdInput').value;
    if (itemId) {
        await uploadItemImage(itemId);
    } else {
        await prepareNewItemImage();
    }
}

async function uploadCover(input) {
    if (!input.files?.[0]) return;
    const file = await openImageCropper(input.files[0], 'cover');
    input.value = '';
    if (!file) return;

    setSaveStatus('A carregar capa...');
    const { data, error } = await uploadFile(file, 'cover');

    if (error || !data) {
        console.error(error);
        setSaveStatus('Não foi possível carregar');
        return;
    }

    const { error: updateError } = await updateRestaurant({ cover_url: data.publicUrl });
    if (updateError) {
        console.error(updateError);
        setSaveStatus('Não foi possível guardar a capa');
        return;
    }
    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalCoverPreview();
    setSaveStatus('Capa guardada', true);
}

async function uploadLogo(input) {
    if (!input.files?.[0]) return;
    const file = await openImageCropper(input.files[0], 'logo');
    input.value = '';
    if (!file) return;

    setSaveStatus('A carregar logótipo...');
    const { data, error } = await uploadFile(file, 'logo');
    if (error || !data) {
        console.error(error);
        setSaveStatus('Não foi possível carregar o logótipo');
        return;
    }

    const { error: updateError } = await updateRestaurant({
        logo_url: data.publicUrl,
        logo_visible: true,
    });
    if (updateError) {
        console.error(updateError);
        setSaveStatus('Não foi possível guardar o logótipo');
        return;
    }

    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalLogoPreview();
    setSaveStatus('Logótipo guardado', true);
}

async function removeLogo() {
    if (!app.restaurant?.logo_url || !window.confirm('Remover o logótipo do menu?')) return;
    const { error } = await updateRestaurant({ logo_url: null, logo_visible: false });
    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível remover o logótipo');
        return;
    }

    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalLogoPreview();
    setSaveStatus('Logótipo removido', true);
}

async function removeCover() {
    if (!app.restaurant.cover_url || !window.confirm('Remover a capa do menu?')) return;
    const { error } = await updateRestaurant({ cover_url: null });
    if (error) {
        console.error(error);
        setSaveStatus('Não foi possível remover a capa');
        return;
    }
    await loadDashboardData();
    if (!qs('heroModal').hidden) setHeroModalCoverPreview();
    setSaveStatus('Capa removida', true);
}

function handleEditorClick(event) {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const category = actionElement.dataset.category
        ? decodeURIComponent(actionElement.dataset.category)
        : app.activeCategory;
    const itemId = actionElement.dataset.itemId;

    if (action === 'select-category') {
        app.activeCategory = actionElement.dataset.category;
        renderDashboard();
    } else if (action === 'open-hero-modal') {
        openHeroModal();
    } else if (action === 'open-categories-modal') {
        openCategoriesModal();
    } else if (action === 'add-item') {
        openItemModal(null, category);
    } else if (action === 'edit-item') {
        openItemModal(app.items.find((item) => String(item.id) === String(itemId)));
    } else if (action === 'delete-item') {
        deleteItem(itemId);
    }
}

function bindEvents() {
    bindHorizontalTabDrag(qs('categoryTabs'));
    qs('heroHeader').addEventListener('click', handleEditorClick);
    qs('categoryTabs').addEventListener('click', (event) => {
        const tab = event.target.closest('.tab-btn');
        if (tab) {
            selectCategoryTab(tab);
            return;
        }
        handleEditorClick(event);
    });
    qs('editCategoriesBtn').addEventListener('click', openCategoriesModal);
    qs('deleteRestaurantBtn').addEventListener('click', openDeleteRestaurantModal);
    qs('deleteRestaurantConfirmInput').addEventListener('input', syncDeleteRestaurantButton);
    qs('deleteRestaurantForm').addEventListener('submit', deleteRestaurant);
    qs('categoryEditor').addEventListener('click', handleEditorClick);
    qs('createRestaurantForm').addEventListener('submit', createRestaurant);

    qs('heroForm').addEventListener('submit', saveHeroModal);
    qs('categoriesForm').addEventListener('submit', saveCategoriesModal);
    qs('addCategoryRowBtn').addEventListener('click', () => addCategoryRow());
    qs('openAppearanceBtn').addEventListener('click', openAppearanceModal);
    qs('openFontBtn').addEventListener('click', openFontModal);
    qs('openQrBtn').addEventListener('click', openQrModal);
    qs('openTutorialBtn').addEventListener('click', toggleTutorial);
    qs('closeTutorialBtn').addEventListener('click', closeTutorial);
    qs('tutorialCards').addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-tutorial-action]');
        if (!actionElement) return;
        moveTutorialStep(actionElement.dataset.tutorialAction === 'prev' ? -1 : 1);
    });
    qs('tutorialOverlay').addEventListener('click', (event) => {
        if (event.target === qs('tutorialOverlay')) closeTutorial();
    });
    ['colorBackgroundInput', 'colorTextInput', 'colorTextSecondaryInput', 'colorPrimaryInput'].forEach((id) => {
        qs(id).addEventListener('input', scheduleAppearanceSave);
    });
    qs('fontSelect').addEventListener('change', scheduleFontSave);
    qs('qrColorBtn').addEventListener('click', () => qs('qrColorInput').click());
    qs('qrColorInput').addEventListener('input', (event) => updateQrColor(event.target.value));
    qs('downloadQrPngBtn').addEventListener('click', downloadQrPng);
    qs('downloadQrPdfBtn').addEventListener('click', downloadQrPdf);
    qs('cropZoomInput').addEventListener('input', updateCropZoom);
    qs('cropFrame').addEventListener('pointerdown', startCropDrag);
    qs('cropFrame').addEventListener('pointermove', moveCropDrag);
    qs('cropFrame').addEventListener('pointerup', stopCropDrag);
    qs('cropFrame').addEventListener('pointercancel', stopCropDrag);
    qs('cancelCropBtn').addEventListener('click', () => closeImageCropper(null));
    qs('cancelCropIconBtn').addEventListener('click', () => closeImageCropper(null));
    qs('confirmCropBtn').addEventListener('click', confirmCropSelection);
    qs('heroCoverPreview').addEventListener('click', () => qs('heroCoverInput').click());
    qs('heroCoverPreview').addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            qs('heroCoverInput').click();
        }
    });
    qs('heroCoverActionBtn').addEventListener('click', (event) => {
        event.stopPropagation();
        if (app.restaurant?.cover_url) {
            removeCover();
        } else {
            qs('heroCoverInput').click();
        }
    });
    qs('heroCoverInput').addEventListener('change', (event) => uploadCover(event.target));
    qs('heroLogoPreview').addEventListener('click', () => qs('heroLogoInput').click());
    qs('heroLogoInput').addEventListener('change', (event) => uploadLogo(event.target));
    qs('heroLogoRemoveBtn').addEventListener('click', removeLogo);
    qs('categoriesModal').addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;
        const row = actionElement.closest('.category-row');

        if (actionElement.dataset.action === 'category-row-move') {
            moveCategoryRow(row, Number(actionElement.dataset.direction));
        } else if (actionElement.dataset.action === 'category-row-delete') {
            deleteCategoryRow(row);
        }
    });

    qs('editCoverBtn').addEventListener('click', () => qs('coverInput').click());
    qs('coverPlaceholder').addEventListener('click', () => qs('coverInput').click());
    qs('coverInput').addEventListener('change', (event) => uploadCover(event.target));
    qs('removeCoverBtn').addEventListener('click', removeCover);
    qs('itemModalImageBtn').addEventListener('click', handleItemModalImageClick);
    qs('itemDeleteBtn').addEventListener('click', () => {
        const itemId = qs('itemIdInput').value;
        if (itemId) deleteItem(itemId);
    });
    qs('itemForm').addEventListener('submit', saveItem);
    document.querySelectorAll('[data-close-modal]').forEach((button) =>
        button.addEventListener('click', (event) => {
            const modal = event.currentTarget.closest('.modal-backdrop');
            if (modal?.id === 'itemModal') {
                closeItemModal();
            } else if (modal) {
                modal.hidden = true;
            }
        }));
    qs('itemModal').addEventListener('click', (event) => {
        if (event.target === qs('itemModal')) closeItemModal();
    });
    qs('heroModal').addEventListener('click', (event) => {
        if (event.target === qs('heroModal')) closeHeroModal();
    });
    qs('categoriesModal').addEventListener('click', (event) => {
        if (event.target === qs('categoriesModal')) closeCategoriesModal();
    });
    qs('appearanceModal').addEventListener('click', (event) => {
        if (event.target === qs('appearanceModal')) closeAppearanceModal();
    });
    qs('fontModal').addEventListener('click', (event) => {
        if (event.target === qs('fontModal')) closeFontModal();
    });
    qs('qrModal').addEventListener('click', (event) => {
        if (event.target === qs('qrModal')) closeQrModal();
    });
    qs('imageCropModal').addEventListener('click', (event) => {
        if (event.target === qs('imageCropModal')) closeImageCropper(null);
    });
    window.addEventListener('resize', () => {
        if (tutorialOpen) positionTutorialCard();
        if (!qs('imageCropModal').hidden) initCropGeometry(true);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !qs('imageCropModal').hidden) {
            closeImageCropper(null);
            return;
        }
        if (event.key === 'Escape' && tutorialOpen) closeTutorial();
    });
}

async function init() {
    try {
        bindEvents();
        const supabase = await getSupabase();
        if (!supabase) {
            qs('authLoading').hidden = true;
            qs('authError').hidden = false;
            return;
        }

        app.supabase = supabase;
        initUploadService(supabase);

        initAuthListener(async (user) => {
            if (authBootstrappedForUser === user.id) return;
            authBootstrappedForUser = user.id;
            app.user = user;
            await loadDashboardData();
        }, () => {
            window.location.href = 'login.html';
        });
    } catch (error) {
        console.error('Dashboard init error:', error);
        qs('authLoading').hidden = true;
        qs('authError').hidden = false;
    }
}

window.signOut = () => signOut();
init();
