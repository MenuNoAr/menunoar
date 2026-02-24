/**
 * tutorial.js - Reactive Interactive Tutorial System
 */
import { scrollToSlide } from './render.js';

let currentTutStep = 0;
let isTutorialActive = false;

const tutorialSteps = [
    {
        id: 'welcome',
        title: "Bem-vindo! 👋",
        text: "Este é o teu painel. Vamos transformar o teu menu num sucesso digital!",
        target: null,
        icon: "fa-rocket"
    },
    {
        id: 'edit_name',
        title: "Edição Direta ✍️",
        text: "Experimenta clicar no nome do restaurante para o editares agora.",
        target: "#restNameEditor",
        icon: "fa-pencil",
        successText: "Excelente! Todo o texto no menu é editável assim."
    },
    {
        id: 'create_cat',
        title: "Nova Categoria 📂",
        text: "Cria uma nova secção (ex: Bebidas ou Sobremesas) clicando no '+'.",
        target: ".btn-add-cat",
        icon: "fa-folder-plus",
        successText: "Boa! Podes criar quantas categorias quiseres."
    },
    {
        id: 'move_cat',
        title: "Organização 📋",
        text: "Podes arrastar as abas para mudar a ordem das categorias no menu.",
        target: "#categoryNav",
        icon: "fa-up-down-left-right"
    },
    {
        id: 'add_item',
        title: "Novo Prato ✨",
        text: "Adiciona o teu primeiro prato ou bebida nesta categoria.",
        target: ".add-item-btn",
        icon: "fa-plus"
    },
    {
        id: 'settings',
        title: "Configurações 🎨",
        text: "Muda a fonte, cores ou ativa o modo PDF para o teu menu aqui.",
        target: "button[onclick='openSettingsModal()']",
        icon: "fa-gear"
    },
    {
        id: 'preview',
        title: "Vê o Menu 🚀",
        text: "Clica para veres o resultado final tal como os teus clientes o verão!",
        target: "#liveLinkBtn",
        icon: "fa-eye"
    }
];

let typeTimeout = null;

export function openTutorial() {
    window.closeAllModals();
    isTutorialActive = true;

    if (document.getElementById('mobileDropbar')?.classList.contains('open')) {
        window.toggleNavDropdown();
    }

    currentTutStep = 0;
    clearOverlays();
    renderStep(0);
}

function clearOverlays() {
    document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow').forEach(el => el.remove());
}

let autoAdvanceTimeout = null;
/**
 * Validates if the user did the right action to advance
 */
window.checkTutorialStep = (stepId) => {
    if (!isTutorialActive || isTransitioning) return;
    const currentStep = tutorialSteps[currentTutStep];

    if (currentStep && (currentStep.id === stepId || stepId.startsWith(currentStep.id))) {
        // Special case for modal openings
        if (stepId.endsWith('_open')) {
            const textTarget = document.getElementById('tutText');
            const tooltip = document.querySelector('.tutorial-tooltip');
            const isMobile = window.innerWidth <= 850;

            if (textTarget && tooltip) {
                if (currentStep.id === 'settings') {
                    textTarget.innerHTML = "<b>Muito bem!</b><br>Aqui podes mudar a fonte, as cores ou ativar o modo PDF.";
                } else {
                    textTarget.innerHTML = "<b>Muito bem!</b><br>Preenche os detalhes do prato e clica em guardar.";
                }

                // Move tooltip to corner to not block modal
                if (isMobile) {
                    Object.assign(tooltip.style, {
                        left: '10px',
                        right: '10px',
                        top: 'auto',
                        bottom: '10px',
                        transform: 'none',
                        width: 'calc(100vw - 20px)',
                        padding: '15px',
                        zIndex: '20005'
                    });
                } else {
                    Object.assign(tooltip.style, {
                        left: 'auto',
                        right: '50px',
                        top: '50%',
                        bottom: 'auto',
                        transform: 'translateY(-50%)',
                        width: '400px',
                        zIndex: '20005',
                        padding: '24px'
                    });
                }

                // Hide spotlight/arrow while modal is open
                document.querySelector('.tutorial-spotlight')?.style.setProperty('display', 'none');
                document.querySelector('.tutorial-arrow')?.style.setProperty('opacity', '0');
            }
            return;
        }

        if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
        showSuccessFeedback();
        autoAdvanceTimeout = setTimeout(() => {
            if (isTutorialActive) window.nextStep();
        }, 1200);
    }
};

function showSuccessFeedback() {
    const textTarget = document.getElementById('tutText');
    if (textTarget) {
        textTarget.innerHTML = '<span style="color:var(--success); font-weight:700; font-size:1.2rem; display:block; margin-top:10px; animation: popSuccess 0.4s cubic-bezier(0.17, 0.89, 0.32, 1.49);">🎉 Muito bem!</span>';
    }
}

function renderStep(index) {
    if (typeTimeout) clearTimeout(typeTimeout);
    currentTutStep = index;
    const step = tutorialSteps[index];

    let spotlight = document.querySelector('.tutorial-spotlight') || createEl('div', 'tutorial-spotlight');
    let tooltip = document.querySelector('.tutorial-tooltip') || createEl('div', 'tutorial-tooltip', { opacity: '0', visibility: 'hidden', transition: 'none' });
    let arrow = document.querySelector('.tutorial-arrow') || createEl('div', 'tutorial-arrow', {}, `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="var(--primary)"/></svg>`);

    tooltip.innerHTML = `
        <div class="tutorial-header"><h3><i class="fa-solid ${step.icon}"></i> ${step.title}</h3></div>
        <p id="tutText" style="min-height: 3em;"></p>
        <div class="tutorial-actions">
            <button class="tutorial-btn-skip" onclick="closeTutorial()">Sair</button>
            <div class="tutorial-step-dots">${tutorialSteps.map((_, i) => `<div class="tutorial-dot ${i === index ? 'active' : ''}"></div>`).join('')}</div>
            <div style="display:flex; gap:8px;">
                ${index > 0 ? `<button class="tutorial-btn-next" style="background:var(--bg-page); color:var(--text); border:1px solid var(--border); padding: 10px 15px;" onclick="prevTutorialPage()">Anterior</button>` : ''}
                <button class="tutorial-btn-next" style="padding: 10px 15px;" onclick="nextStep()">${index === tutorialSteps.length - 1 ? 'Finalizar' : 'Seguinte'}</button>
            </div>
        </div>
    `;

    const textTarget = tooltip.querySelector('#tutText');
    let i = 0;
    const type = () => {
        if (i < step.text.length) {
            textTarget.textContent += step.text.charAt(i);
            i++;
            typeTimeout = setTimeout(type, 10);
        }
    };
    type();

    const isMobile = window.innerWidth <= 850;
    let targetSelector = step.target;

    if (isMobile) {
        if (targetSelector === "button[onclick='openSettingsModal()']") {
            targetSelector = ".mobile-dropbar button[onclick*='openSettingsModal']";
        } else if (targetSelector === "#liveLinkBtn") {
            targetSelector = "#liveLinkBtnMobile";
        }
    }

    const targetEl = targetSelector ? document.querySelector(targetSelector) : null;

    // Auto-scroll logic
    if (step.id === 'add_item' || step.id === 'create_cat') {
        scrollToSlide(0, { instant: true });
    }

    if (targetEl) {
        // Ensure dropbar is open if target is inside it
        if (isMobile && (targetSelector.includes('mobile-dropbar') || targetSelector.includes('Mobile'))) {
            if (!document.getElementById('mobileDropbar').classList.contains('open')) window.toggleNavDropdown();
        } else if (isMobile && document.getElementById('mobileDropbar').classList.contains('open')) {
            window.toggleNavDropdown();
        }

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const placement = (targetEl.getBoundingClientRect().top > window.innerHeight / 2) ? 'above' : 'below';

        let startTime = performance.now();
        const sync = (now) => {
            const rect = targetEl.getBoundingClientRect(), padding = 10;
            if (rect.width === 0) return; // Hidden
            Object.assign(spotlight.style, { opacity: '1', left: `${rect.left - padding}px`, top: `${rect.top - padding}px`, width: `${rect.width + padding * 2}px`, height: `${rect.height + padding * 2}px`, display: 'block', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)' });
            positionTooltipAndArrow(rect, tooltip, arrow, placement);
            if (now - startTime < 1000) requestAnimationFrame(sync);
        };
        sync(startTime);
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    } else {
        if (isMobile && document.getElementById('mobileDropbar').classList.contains('open')) window.toggleNavDropdown();
        Object.assign(spotlight.style, { opacity: '0', display: 'none' });
        Object.assign(tooltip.style, {
            left: '50%', right: 'auto',
            top: '50%', bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            opacity: '1', visibility: 'visible',
            width: isMobile ? 'calc(100vw - 40px)' : '540px'
        });
        arrow.style.opacity = '0';
    }
}

function createEl(tag, className, styles = {}, html = '') {
    const el = document.createElement(tag);
    el.className = className;
    Object.assign(el.style, styles);
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
}

function positionTooltipAndArrow(rect, tooltip, arrow, placement) {
    const isMobile = window.innerWidth <= 850;
    const margin = 20, tooltipWidth = isMobile ? Math.min(window.innerWidth - 40, 340) : 540;
    const tooltipHeight = tooltip.offsetHeight;
    let tx = rect.left + rect.width / 2 - tooltipWidth / 2;
    tx = Math.max(20, Math.min(tx, window.innerWidth - tooltipWidth - 20));

    let ty, ax = rect.left + rect.width / 2 - 12, ay, ar;
    if (placement === 'above') {
        ty = rect.top - tooltipHeight - margin - 10; ay = rect.top - margin - 5; ar = 180;
    } else {
        ty = rect.bottom + margin + 10; ay = rect.bottom + margin - 15; ar = 0;
    }
    Object.assign(tooltip.style, {
        left: `${tx}px`, right: 'auto',
        top: `${ty}px`, bottom: 'auto',
        transform: 'none',
        width: tooltipWidth + 'px'
    });
    Object.assign(arrow.style, { opacity: '1', left: `${ax}px`, top: `${ay}px`, transform: `rotate(${ar}deg)` });
}

let isTransitioning = false;
window.nextStep = () => {
    if (isTransitioning) return;
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);

    // Force save if we are on an editable step by blurring the target
    const step = tutorialSteps[currentTutStep];
    if (step && step.target) {
        const targetEl = document.querySelector(step.target);
        if (targetEl && (targetEl.contentEditable === 'true' || targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA')) {
            targetEl.blur();
        }
    }

    if (currentTutStep < tutorialSteps.length - 1) {
        isTransitioning = true;
        renderStep(++currentTutStep);
        setTimeout(() => { isTransitioning = false; }, 400);
    } else {
        window.closeTutorial();
    }
};
window.prevTutorialPage = () => currentTutStep > 0 && renderStep(--currentTutStep);
window.closeTutorial = () => {
    isTutorialActive = false;
    document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow').forEach(el => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    });
};
