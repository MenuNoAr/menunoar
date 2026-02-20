/**
 * tutorial.js - Interactive Tutorial System
 */
import { scrollToSlide } from './render.js';

let currentTutStep = 0;
const tutorialSteps = [
    { title: "Bem-vindo, Chef! 👋", text: "Este é o teu novo painel de controlo. Vamos mostrar-te como criar um menu incrível em segundos.", target: null, icon: "fa-rocket" },
    { title: "Edição Instantânea ✍️", text: "Clica em qualquer texto (nome, descrição, preço) para o editares na hora. Tenta no nome do restaurante!", target: "#restNameEditor", icon: "fa-pencil" },
    { title: "Categorias 📂", text: "Organiza o teu menu por secções. Podes arrastar as abas para as reordenar como quiseres.", target: "#categoryNav", icon: "fa-layer-group" },
    { title: "Adicionar Pratos ✨", text: "Clica aqui para adicionar um prato novo na categoria que estás a ver.", target: ".add-item-btn", icon: "fa-plus" },
    { title: "Personalização 🎨", text: "Aqui podes mudar o teu link (slug), as cores do menu e ativar o modo PDF.", target: "button[onclick='openSettingsModal()']", icon: "fa-gear" },
    { title: "Ver Resultado 🚀", text: "Clica aqui para veres como os teus clientes verão o teu menu live!", target: "#liveLinkBtn", icon: "fa-eye" }
];

export function openTutorial() {
    window.closeAllModals();
    currentTutStep = 0;
    document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow').forEach(el => el.remove());
    renderStep(0);
}

function renderStep(index) {
    currentTutStep = index;
    const step = tutorialSteps[index];

    let spotlight = document.querySelector('.tutorial-spotlight') || createEl('div', 'tutorial-spotlight');
    let tooltip = document.querySelector('.tutorial-tooltip') || createEl('div', 'tutorial-tooltip', { opacity: '0', visibility: 'hidden', transition: 'none' });
    let arrow = document.querySelector('.tutorial-arrow') || createEl('div', 'tutorial-arrow', {}, `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="var(--primary)"/></svg>`);

    tooltip.innerHTML = `
        <div class="tutorial-header"><h3><i class="fa-solid ${step.icon}"></i> ${step.title}</h3></div>
        <p>${step.text}</p>
        <div class="tutorial-actions">
            <button class="tutorial-btn-skip" onclick="closeTutorial()">Sair</button>
            <div class="tutorial-step-dots">${tutorialSteps.map((_, i) => `<div class="tutorial-dot ${i === index ? 'active' : ''}"></div>`).join('')}</div>
            <div style="display:flex; gap:8px;">
                ${index > 0 ? `<button class="tutorial-btn-next" style="background:var(--bg-page); color:var(--text); border:1px solid var(--border); padding: 10px 15px;" onclick="prevTutorialPage()">Anterior</button>` : ''}
                <button class="tutorial-btn-next" style="padding: 10px 15px;" onclick="nextStep()">${index === tutorialSteps.length - 1 ? 'Começar!' : 'Próximo'}</button>
            </div>
        </div>
    `;

    const targetEl = step.target ? document.querySelector(step.target) : null;
    if (step.target === '.add-item-btn') scrollToSlide(0, { instant: true });

    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        const placement = (targetEl.getBoundingClientRect().top > window.innerHeight / 2) ? 'above' : 'below';
        let startTime = performance.now();

        const sync = (now) => {
            const rect = targetEl.getBoundingClientRect(), padding = 10;
            Object.assign(spotlight.style, { opacity: '1', left: `${rect.left - padding}px`, top: `${rect.top - padding}px`, width: `${rect.width + padding * 2}px`, height: `${rect.height + padding * 2}px`, display: 'block', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)' });
            positionTooltipAndArrow(rect, tooltip, arrow, placement);
            if (now - startTime < 800) requestAnimationFrame(sync);
        };
        sync(startTime);
        tooltip.style.visibility = 'visible';
        requestAnimationFrame(sync);
    } else {
        Object.assign(spotlight.style, { opacity: '0', display: 'none' });
        Object.assign(tooltip.style, { transition: 'none', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: '1', visibility: 'visible' });
        arrow.style.opacity = '0';
        tooltip.offsetHeight;
        setTimeout(() => tooltip.style.transition = 'opacity 0.3s ease', 50);
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
    const margin = 20, tooltipWidth = 480, tooltipHeight = tooltip.offsetHeight;
    let tx = rect.left + rect.width / 2 - tooltipWidth / 2;
    tx = Math.max(20, Math.min(tx, window.innerWidth - tooltipWidth - 20));

    let ty, ax = rect.left + rect.width / 2 - 12, ay, ar;
    if (placement === 'above') {
        ty = rect.top - tooltipHeight - margin - 10; ay = rect.top - margin - 5; ar = 180;
    } else {
        ty = rect.bottom + margin + 10; ay = rect.bottom + margin - 15; ar = 0;
    }
    Object.assign(tooltip.style, { left: `${tx}px`, top: `${ty}px`, transform: 'none' });
    Object.assign(arrow.style, { opacity: '1', left: `${ax}px`, top: `${ay}px`, transform: `rotate(${ar}deg)` });
}

window.nextStep = () => currentTutStep < tutorialSteps.length - 1 ? renderStep(++currentTutStep) : window.closeTutorial();
window.prevTutorialPage = () => currentTutStep > 0 && renderStep(--currentTutStep);
window.closeTutorial = () => document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow').forEach(el => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); });
