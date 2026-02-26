/**
 * tutorial.js - Modern, Revolutionary Interactive Onboarding
 * Employs SVG masking, smooth interpolation, and glassmorphism.
 */
import { scrollToSlide } from './render.js';

let currentStepIndex = 0;
let isActive = false;
let isTransitioning = false;

// DOM Elements
let tourBackdrop, tourPopover, tourCutout;

const steps = [
    {
        id: 'welcome',
        title: "Bem-vindo ao Topo 🚀",
        text: "Desenhámos uma experiência de gestão incrivelmente fluida. Vamos fazer uma rápida visita guiada para te habituares?",
        target: null,
        placement: 'center',
        buttonLabel: 'Começar Tour'
    },
    {
        id: 'edit_name',
        title: "Edição Invisível ✍️",
        text: "Tudo o que vês no painel é editável num clique. Experimenta clicar no nome do teu restaurante agora mesmo.",
        target: "#restNameEditor",
        placement: 'bottom',
        waitForAction: true
    },
    {
        id: 'create_cat',
        title: "Cria as Tuas Secções 📂",
        text: "Bebidas, Pratos Principais, Sobremesas... Clica no botão '+' para criares uma nova categoria para o teu menu.",
        target: ".btn-add-cat",
        placement: 'bottom',
        waitForAction: true
    },
    {
        id: 'add_item',
        title: "Adiciona Magia ✨",
        text: "Aqui começas a compor o teu menu com pratos, preços e descrições radiantes. Ficará deslumbrante.",
        target: ".add-item-btn",
        placement: 'top'
    },
    {
        id: 'settings',
        title: "A Tua Identidade 🎨",
        text: "Cores, tipografia e modo PDF. Todo o poder da personalização do teu menu está guardado aqui nesta engrenagem.",
        target: () => window.innerWidth <= 850 ? ".mobile-nav-trigger" : "button[onclick='openSettingsModal()']",
        placement: 'bottom'
    },
    {
        id: 'preview',
        title: "Ao Vivo e a Cores 🌟",
        text: "Sempre que quiseres ver como os teus clientes vêem o teu menu em direto, clica aqui. Aproveita a viagem!",
        target: () => window.innerWidth <= 850 ? ".mobile-nav-trigger" : "#liveLinkBtn",
        placement: 'bottom',
        buttonLabel: 'Concluir!'
    }
];

export function openTutorial(resume = false) {
    if (isActive) return;
    isActive = true;

    // Close any open sidebars/modals
    window.closeAllModals?.();
    if (document.getElementById('mobileDropbar')?.classList.contains('open')) {
        window.toggleNavDropdown?.(true);
    }

    currentStepIndex = (resume && localStorage.getItem('tut_step')) ? parseInt(localStorage.getItem('tut_step')) : 0;

    injectStyles();
    injectElements();

    // Slight delay to allow animations to flow in
    setTimeout(() => renderStep(), 50);
}

export function closeTutorial() {
    isActive = false;
    document.body.classList.remove('tut-active-freeze');
    cleanupElements();
    localStorage.removeItem('tut_step');
    localStorage.removeItem('tutorial_running');
}

window.openTutorial = openTutorial;
window.closeTutorial = closeTutorial;

window.checkTutorialStep = (actionId) => {
    if (!isActive) return;

    const step = steps[currentStepIndex];
    if (!step) return;

    // Handle modal opens specifically so we don't skip the step instantly
    if (actionId === step.id + '_open') {
        const btn = tourPopover.querySelector('.tut-next-btn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Boa, agora podes continuar.';
            btn.classList.add('tut-success-pulse');
            btn.classList.remove('waiting');
            btn.style.pointerEvents = 'auto'; // allow manual continuation inside the modal
            btn.style.opacity = '1';
        }
        return;
    }

    if (step.id === actionId) {
        // Success animation
        const btn = tourPopover.querySelector('.tut-next-btn');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Perfeito!';
            btn.classList.add('tut-success-pulse');
            setTimeout(() => window.nextStep(), 800);
        } else {
            window.nextStep();
        }
    }
};

window.nextStep = () => {
    if (currentStepIndex >= steps.length - 1) {
        closeTutorial();
        return;
    }
    currentStepIndex++;
    localStorage.setItem('tut_step', currentStepIndex);
    localStorage.setItem('tutorial_running', 'true');
    renderStep();
};

window.prevStep = () => {
    if (currentStepIndex <= 0) return;
    currentStepIndex--;
    localStorage.setItem('tut_step', currentStepIndex);
    renderStep();
};

function renderStep() {
    const step = steps[currentStepIndex];
    document.body.classList.add('tut-active-freeze');

    // Clear old active targets
    document.querySelectorAll('.tut-active-el').forEach(e => {
        e.classList.remove('tut-active-el');
        e.style.zIndex = '';
        e.style.position = '';
        e.style.pointerEvents = '';
    });

    let targetEl = null;
    if (step.target) {
        let selector = typeof step.target === 'function' ? step.target() : step.target;
        targetEl = document.querySelector(selector);
    }

    // Auto-scroll logic if specific step
    if (step.id === 'add_item' || step.id === 'create_cat') {
        scrollToSlide(0, { instant: true });
    }

    if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Boost target
        targetEl.classList.add('tut-active-el');
        const computed = window.getComputedStyle(targetEl);
        if (computed.position === 'static') {
            targetEl.style.position = 'relative';
        }
        targetEl.style.zIndex = '100005';
        targetEl.style.pointerEvents = 'auto';

        // Boost positioned parents to bypass fixed headers trapping z-indexes
        let p = targetEl.parentElement;
        while (p && p !== document.body) {
            const style = window.getComputedStyle(p);
            if (style.position !== 'static' || style.zIndex !== 'auto' || style.transform !== 'none') {
                p.classList.add('tut-active-el');
                p.style.zIndex = '100004';
            }
            p = p.parentElement;
        }

        // Keep position perfectly synced
        updateHighlight(targetEl, step.placement);

        // Constant sync for scrolling
        if (window.tutSyncInterval) clearInterval(window.tutSyncInterval);
        window.tutSyncInterval = setInterval(() => {
            if (isActive && targetEl && document.contains(targetEl)) {
                updateHighlight(targetEl, step.placement);
            }
        }, 16); // ~60fps sync

        tourBackdrop.style.opacity = '1';

    } else {
        if (window.tutSyncInterval) clearInterval(window.tutSyncInterval);

        // Hide cutout (drop it off screen)
        tourCutout.style.top = '-9999px';
        tourCutout.style.left = '-9999px';
        tourCutout.style.width = '0px';
        tourCutout.style.height = '0px';

        tourPopover.style.top = '50%';
        tourPopover.style.left = '50%';
        tourPopover.style.transform = 'translate(-50%, -50%)';

        tourBackdrop.style.opacity = '1';
    }

    // Render contents inside Popover
    tourPopover.className = 'tut-popover open';
    tourPopover.innerHTML = `
        <div class="tut-progress">
            ${steps.map((_, i) => `<div class="tut-dot ${i === currentStepIndex ? 'active' : ''}"></div>`).join('')}
        </div>
        <div class="tut-content">
            <h3 class="tut-title">${step.title}</h3>
            <p class="tut-text">${step.text}</p>
        </div>
        <div class="tut-footer">
            <button class="tut-skip-btn" onclick="closeTutorial()">Pular</button>
            <div class="tut-actions-right">
                ${currentStepIndex > 0 ? `<button class="tut-prev-btn" onclick="window.prevStep()"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
                ${!step.waitForAction
            ? `<button class="tut-next-btn" onclick="window.nextStep()">${step.buttonLabel || 'Continuar'}</button>`
            : `<button class="tut-next-btn waiting"><i class="fa-solid fa-circle-notch fa-spin"></i> Aguardando ação...</button>`
        }
            </div>
        </div>
    `;

    // Small cascade text animation
    const contentText = tourPopover.querySelector('.tut-content');
    contentText.style.opacity = '0';
    contentText.style.transform = 'translateY(10px)';
    setTimeout(() => {
        contentText.style.transition = 'all 0.4s ease';
        contentText.style.opacity = '1';
        contentText.style.transform = 'translateY(0)';
    }, 50);
}

function updateHighlight(targetEl, placement) {
    const rect = targetEl.getBoundingClientRect();
    const padding = 12;

    // Update SVG cutout (the spotlight)
    tourCutout.style.top = (rect.top - padding) + 'px';
    tourCutout.style.left = (rect.left - padding) + 'px';
    tourCutout.style.width = (rect.width + padding * 2) + 'px';
    tourCutout.style.height = (rect.height + padding * 2) + 'px';

    // Position popover
    const pWidth = 360; // Max width of popover
    let pTop, pLeft, tX, tY;
    const margin = 20;

    // Default center placement based on target
    pLeft = rect.left + (rect.width / 2);
    tX = '-50%';

    // Constrain X to screen bounds
    if (pLeft < pWidth / 2 + margin) {
        pLeft = margin + pWidth / 2;
    } else if (pLeft > window.innerWidth - (pWidth / 2) - margin) {
        pLeft = window.innerWidth - margin - (pWidth / 2);
    }

    if (placement === 'top') {
        pTop = rect.top - margin;
        tY = 'calc(-100% - 10px)'; // pull up
    } else {
        // bottom or default
        pTop = rect.bottom + margin;
        tY = '10px';
    }

    // Mobile specific safety (if modal falls off bottom)
    if (pTop > window.innerHeight - 200) {
        pTop = rect.top - margin;
        tY = 'calc(-100% - 10px)';
    }

    if (window.innerWidth <= 600) {
        // On very small screens just fix to bottom
        pTop = window.innerHeight - margin;
        pLeft = 50;
        tX = '0%';
        tY = 'calc(-100%)';
        tourPopover.style.left = '20px';
        tourPopover.style.right = '20px';
        tourPopover.style.width = 'auto'; // fluid
        tourPopover.style.transform = `translateY(${tY})`;
    } else {
        tourPopover.style.width = pWidth + 'px';
        tourPopover.style.left = pLeft + 'px';
        tourPopover.style.transform = `translate(${tX}, ${tY})`;
    }

    tourPopover.style.top = window.innerWidth <= 600 ? 'auto' : pTop + 'px';
}

function injectElements() {
    if (document.getElementById('tut-backdrop-svg')) return;

    // We use a CSS box-shadow trick for a smooth cut-out spotlight rather than an SVG 
    // because it handles border-radius and reflow transitions much smoother.
    tourBackdrop = document.createElement('div');
    tourBackdrop.id = 'tut-backdrop';
    document.body.appendChild(tourBackdrop);

    tourCutout = document.createElement('div');
    tourCutout.id = 'tut-cutout';
    document.body.appendChild(tourCutout);

    tourPopover = document.createElement('div');
    tourPopover.id = 'tut-popover';
    document.body.appendChild(tourPopover);
}

function cleanupElements() {
    if (window.tutSyncInterval) clearInterval(window.tutSyncInterval);
    document.getElementById('tut-backdrop')?.remove();
    document.getElementById('tut-cutout')?.remove();
    document.getElementById('tut-popover')?.remove();
    document.getElementById('tut-styles')?.remove();
}

function injectStyles() {
    if (document.getElementById('tut-styles')) return;
    const style = document.createElement('style');
    style.id = 'tut-styles';
    style.innerHTML = `
        /* Freeze background scroll when tutorial active */
        body.tut-active-freeze {
            overflow: hidden !important;
        }

        /* The dimming backdrop */
        #tut-backdrop {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 100000;
            opacity: 0;
            transition: opacity 0.5s ease;
            pointer-events: auto; /* Block background clicks */
        }

        /* The transparent hole / pulsating ring */
        #tut-cutout {
            position: fixed;
            z-index: 100001;
            border-radius: 12px;
            box-shadow: 0 0 0 4px var(--primary), 0 0 30px rgba(31, 168, 255, 0.6);
            transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
            pointer-events: none; /* Let clicks pass through */
        }

        /* Pulse animation for the cutout */
        @keyframes tutPulse {
            0% { box-shadow: 0 0 0 0px rgba(31, 168, 255, 0.7), 0 0 0 4px var(--primary); }
            70% { box-shadow: 0 0 0 15px rgba(31, 168, 255, 0), 0 0 0 4px var(--primary); }
            100% { box-shadow: 0 0 0 0px rgba(31, 168, 255, 0), 0 0 0 4px var(--primary); }
        }
        #tut-cutout {
            animation: tutPulse 2s infinite;
            background: rgba(255, 255, 255, 0.05); /* Slight lightening */
        }

        /* Modern Popover Card */
        #tut-popover {
            position: fixed;
            z-index: 100006;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
            font-family: 'Inter', sans-serif;
            pointer-events: auto;
            max-width: 90vw;
        }

        #tut-popover.open {
            opacity: 1;
            visibility: visible;
        }

        /* Dark Mode Popover override */
        body.dark-mode #tut-popover {
            background: rgba(30,30,30,0.95);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
            color: #fff;
        }

        .tut-progress {
            display: flex;
            gap: 6px;
            margin-bottom: 20px;
            align-items: center;
        }

        .tut-dot {
            height: 6px;
            width: 16px;
            border-radius: 10px;
            background: rgba(0,0,0,0.1);
            transition: all 0.3s ease;
        }
        body.dark-mode .tut-dot { background: rgba(255,255,255,0.1); }
        .tut-dot.active {
            background: var(--primary);
            width: 32px;
        }

        .tut-title {
            font-size: 1.25rem;
            font-weight: 800;
            margin-bottom: 10px;
            color: var(--text);
            letter-spacing: -0.02em;
        }
        
        .tut-text {
            font-size: 0.95rem;
            line-height: 1.5;
            color: var(--text-muted);
            margin-bottom: 24px;
        }

        .tut-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .tut-skip-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 8px;
            transition: background 0.2s;
        }
        .tut-skip-btn:hover { background: rgba(0,0,0,0.05); }
        body.dark-mode .tut-skip-btn:hover { background: rgba(255,255,255,0.05); }

        .tut-actions-right {
            display: flex;
            gap: 8px;
        }

        .tut-prev-btn {
            background: rgba(0,0,0,0.05);
            color: var(--text);
            border: none;
            width: 42px;
            height: 42px;
            border-radius: 12px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        }
        body.dark-mode .tut-prev-btn { background: rgba(255,255,255,0.1); color: #fff; }
        .tut-prev-btn:hover { background: rgba(0,0,0,0.1); transform: scale(1.05); }

        .tut-next-btn {
            background: var(--primary);
            color: #fff;
            border: none;
            padding: 0 20px;
            height: 42px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.17, 0.89, 0.32, 1.49);
            box-shadow: 0 4px 15px var(--primary-glow);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .tut-next-btn:not(.waiting):hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px var(--primary-glow);
        }
        
        .tut-next-btn.waiting {
            background: rgba(31, 168, 255, 0.1) !important;
            color: var(--primary) !important;
            box-shadow: none;
        }
        .tut-next-btn.tut-success-pulse {
            background: var(--success);
            box-shadow: 0 0 0 6px rgba(22, 163, 74, 0.3);
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);
}
