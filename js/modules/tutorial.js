/* tutorial.js - Revolutionary Insight Card + Orbit Tutorial */
import { scrollToSlide } from './render.js';

let currentTutStep = 0;
let isTutorialActive = false;

// Step Definitions
const tutorialSteps = [
    {
        id: 'welcome',
        title: "Dá vida ao teu Menu",
        text: "Bem-vindo ao teu novo painel profissional. Vamos aprender a transformar completamente o teu menu em poucos segundos.",
        target: null,
        icon: "fa-rocket"
    },
    {
        id: 'edit_name',
        title: "Edição por Intuição",
        text: "Clica literalmente onde queres ditar a lei. Podes começar agora mesmo no Nome do teu Restaurante.",
        target: "#restNameEditor",
        icon: "fa-pen-nib",
        successText: "Perfeito! Aquilo que tu vês, é exatamente o que o teu cliente recebe."
    },
    {
        id: 'create_cat',
        title: "Categorias Fluidas",
        text: "Clica no '+' mágico para criares uma nova aba: Sobremesas, Pizzas, Bebidas.",
        target: ".btn-add-cat",
        icon: "fa-layer-group",
        successText: "Criado. Depois podes reordená-las à tua vontade apenas arrastando."
    },
    {
        id: 'add_item',
        title: "O Primeiro Prato",
        text: "Injeta a tua comida nesta categoria. Imagem, descrição saborosa e um preço apetecível.",
        target: ".add-item-btn",
        icon: "fa-wand-magic-sparkles"
    },
    {
        id: 'settings',
        title: "O Motor de Design",
        text: "Clica aqui. Esta é a sala de máquinas. Define letras elegantes, liga as tuas cores, ou ativa o uso do PDF se preferires a via estática.",
        target: "button[onclick='openSettingsModal()']",
        icon: "fa-sliders"
    },
    {
        id: 'preview',
        title: "100% Online e Ao Vivo",
        text: "Acabaste? Espreita o botão Ver Menu para garantires que ficou deslumbrante na perspetiva do teu cliente final.",
        target: "#liveLinkBtn",
        icon: "fa-bolt"
    }
];

let typeTimeout = null;
let autoAdvanceTimeout = null;
let currentTargetEl = null;

let isTransitioning = false;
let isModalOverride = false;
let syncFrameId = null;

const isMobileDevice = () => window.innerWidth <= 850;

export function openTutorial(forceResume = false) {
    if (window.closeAllModals) window.closeAllModals();
    isTutorialActive = true;
    document.body.classList.add('tut-running');

    if (document.getElementById('mobileDropbar')?.classList.contains('open')) {
        if (window.toggleNavDropdown) window.toggleNavDropdown();
    }

    const savedStep = localStorage.getItem('tutorial_step');
    if (forceResume && savedStep !== null) {
        currentTutStep = parseInt(savedStep, 10);
    } else {
        currentTutStep = 0;
        localStorage.setItem('tutorial_step', '0');
    }

    buildUI();
    renderStep(currentTutStep);
}

// Builds the raw DOM elements if they don't exist
function buildUI() {
    if (!document.querySelector('.tut-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'tut-overlay active';
        document.body.appendChild(overlay);
    } else {
        document.querySelector('.tut-overlay').classList.add('active');
    }

    if (!document.querySelector('.tut-orb-wrapper')) {
        const orb = document.createElement('div');
        orb.className = 'tut-orb-wrapper';
        document.body.appendChild(orb);
    }

    if (!document.querySelector('.tut-card')) {
        const card = document.createElement('div');
        card.className = 'tut-card';
        document.body.appendChild(card);
    }
}

window.checkTutorialStep = (stepId) => {
    if (!isTutorialActive || isTransitioning) return;
    const currentStep = tutorialSteps[currentTutStep];

    if (currentStep && (currentStep.id === stepId || stepId.startsWith(currentStep.id))) {

        if (stepId.endsWith('_open')) {
            isModalOverride = true;
            showSuccessInline(currentStep);
            const card = document.querySelector('.tut-card');

            // Re-anchor to screen center or clear area gracefully
            card.style.transform = `translateY(0) scale(1)`;
            if (isMobileDevice()) {
                card.style.top = '16px';
                card.style.bottom = 'auto';
            } else {
                card.style.top = '50%';
                card.style.bottom = 'auto';
                card.style.left = '50%';
                card.style.right = 'auto';
                card.style.transform = `translate(-50%, -50%) scale(1)`;
            }

            document.querySelector('.tut-orb-wrapper').style.opacity = '0';
            return;
        }

        if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
        showSuccessInline(currentStep, true);

        const delay = currentStep.id === 'settings' ? 0 : 800;
        autoAdvanceTimeout = setTimeout(() => {
            if (isTutorialActive) window.nextStep();
        }, delay);
    }
};

function showSuccessInline(currentStep, animateIcon = false) {
    const textTarget = document.querySelector('.tut-text');
    if (!textTarget) return;
    const msg = currentStep.successText || "Incrível! Vamos avançar para o próximo nível.";
    textTarget.innerHTML = `<span style="color: #10b981; font-weight: 600; font-size: 0.95rem;">✨ ${msg}</span>`;
}

function renderStep(index) {
    if (typeTimeout) clearTimeout(typeTimeout);
    isModalOverride = false;
    localStorage.setItem('tutorial_step', index.toString());
    localStorage.setItem('tutorial_running', 'true');

    if (currentTargetEl) {
        currentTargetEl.classList.remove('tut-active-target');
        currentTargetEl = null;
    }
    document.querySelectorAll('.tut-parent-boost').forEach(el => el.classList.remove('tut-parent-boost'));

    if (window.closeAllModals) window.closeAllModals();
    if (window.closeModal) window.closeModal('mobileDropbar');

    currentTutStep = index;
    const step = tutorialSteps[index];

    let orb = document.querySelector('.tut-orb-wrapper');
    let card = document.querySelector('.tut-card');

    // UI Assembly inside Card
    const dotsHtml = tutorialSteps.map((_, i) => `<div class="tut-dot ${i === index ? 'active' : ''}"></div>`).join('');

    card.innerHTML = `
        <button class="tut-close" onclick="closeTutorial()"><i class="fa-solid fa-xmark"></i></button>
        <div class="tut-header">
            <div class="tut-icon-box"><i class="fa-solid ${step.icon}"></i></div>
            <h3 class="tut-title">${step.title}</h3>
        </div>
        <p class="tut-text"></p>
        <div class="tut-footer">
            <div class="tut-progress">${dotsHtml}</div>
            <button class="tut-btn" onclick="nextStep()">${index === tutorialSteps.length - 1 ? 'Concluir' : 'Continuar'}</button>
        </div>
    `;

    // Typewriter effect
    const textTarget = card.querySelector('.tut-text');
    let i = 0;
    const type = () => {
        if (i < step.text.length) {
            textTarget.textContent += step.text.charAt(i);
            i++;
            typeTimeout = setTimeout(type, 12);
        }
    };
    type();

    let targetSelector = step.target;
    if (isMobileDevice()) {
        if (targetSelector === "button[onclick='openSettingsModal()']") {
            targetSelector = ".mobile-dropbar button[onclick*='openSettingsModal']";
        } else if (targetSelector === "#liveLinkBtn") {
            targetSelector = "#liveLinkBtnMobile";
        }
    }

    const targetEl = targetSelector ? document.querySelector(targetSelector) : null;
    currentTargetEl = targetEl;

    if (step.id === 'add_item' || step.id === 'create_cat') {
        scrollToSlide(0, { instant: true });
    }

    if (targetEl) {
        targetEl.classList.add('tut-active-target');

        let parent = targetEl.parentElement;
        while (parent && parent !== document.body) {
            const s = window.getComputedStyle(parent);
            if (s.position !== 'static' || (s.zIndex !== 'auto' && s.zIndex !== '0')) {
                parent.classList.add('tut-parent-boost');
            }
            parent = parent.parentElement;
        }

        if (isMobileDevice() && (targetSelector.includes('mobile-dropbar') || targetSelector.includes('Mobile'))) {
            if (!document.getElementById('mobileDropbar').classList.contains('open') && window.toggleNavDropdown) {
                window.toggleNavDropdown();
            }
        } else if (isMobileDevice() && document.getElementById('mobileDropbar').classList.contains('open') && window.toggleNavDropdown) {
            window.toggleNavDropdown();
        }

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        card.classList.add('active');
        orb.style.opacity = '1';

        const sync = () => {
            if (!isTutorialActive || currentTargetEl !== targetEl || isModalOverride) {
                if (syncFrameId) cancelAnimationFrame(syncFrameId);
                return;
            }
            const rect = targetEl.getBoundingClientRect(), pad = 6;
            if (rect.width > 0 && rect.height > 0) {
                // Orb follows target precisely
                Object.assign(orb.style, {
                    left: `${rect.left - pad}px`,
                    top: `${rect.top - pad}px`,
                    width: `${rect.width + pad * 2}px`,
                    height: `${rect.height + pad * 2}px`
                });

                // Card follows intelligently
                positionCard(rect, card);
            }
            syncFrameId = requestAnimationFrame(sync);
        };
        syncFrameId = requestAnimationFrame(sync);

    } else {
        orb.style.opacity = '0';
        card.classList.add('active');

        if (isMobileDevice()) {
            card.style.top = 'auto';
            card.style.bottom = '24px';
            card.style.left = '16px';
            card.style.right = '16px';
            card.style.transform = 'none';
        } else {
            Object.assign(card.style, {
                top: '50%', left: '50%', transform: 'translate(-50%, -50%) scale(1)'
            });
        }
    }
}

function positionCard(rect, card) {
    if (isMobileDevice()) {
        card.style.transform = `none`;
        card.style.left = '16px';
        card.style.right = '16px';
        if (rect.top < window.innerHeight / 2) {
            card.style.top = 'auto';
            card.style.bottom = '24px';
        } else {
            card.style.bottom = 'auto';
            card.style.top = '24px';
        }
        return;
    }

    const cardWidth = 320;
    const cardHeight = card.offsetHeight || 180;
    const margin = 24;

    let tx = rect.left + rect.width / 2 - cardWidth / 2;
    tx = Math.max(20, Math.min(tx, window.innerWidth - cardWidth - 20));

    let ty;
    if (rect.top > window.innerHeight / 2) {
        // Place above
        ty = rect.top - cardHeight - margin;
    } else {
        // Place below
        ty = rect.bottom + margin;
    }

    Object.assign(card.style, {
        top: `${ty}px`,
        left: `${tx}px`,
        bottom: 'auto',
        right: 'auto',
        transform: `translateY(0) scale(1)`
    });
}

window.nextStep = () => {
    if (isTransitioning) return;
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);

    const step = tutorialSteps[currentTutStep];
    if (step && step.target) {
        const tEl = document.querySelector(step.target);
        if (tEl && (tEl.isContentEditable || tEl.tagName === 'INPUT')) {
            tEl.blur();
        }
    }

    if (currentTutStep < tutorialSteps.length - 1) {
        isTransitioning = true;
        renderStep(++currentTutStep);
        setTimeout(() => { isTransitioning = false; }, 500);
    } else {
        window.closeTutorial();
    }
};

window.closeTutorial = () => {
    isTutorialActive = false;
    document.body.classList.remove('tut-running');
    localStorage.removeItem('tutorial_step');
    localStorage.removeItem('tutorial_running');

    if (currentTargetEl) {
        currentTargetEl.classList.remove('tut-active-target');
        currentTargetEl = null;
    }
    document.querySelectorAll('.tut-parent-boost').forEach(el => el.classList.remove('tut-parent-boost'));

    const overlay = document.querySelector('.tut-overlay');
    const card = document.querySelector('.tut-card');
    const orb = document.querySelector('.tut-orb-wrapper');

    if (overlay) overlay.classList.remove('active');
    if (card) {
        card.classList.remove('active');
        card.style.transform = 'translateY(20px) scale(0.95)';
    }
    if (orb) orb.style.opacity = '0';

    setTimeout(() => {
        if (overlay) overlay.remove();
        if (card) card.remove();
        if (orb) orb.remove();
    }, 600);
};
