/**
 * dashboard.js - Studio Edition Entry Point
 * Aligned with the premium lifestyle identity.
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import { initAuthListener, getSupabase } from './auth-service.js';
import { initUploadService } from './upload-service.js';

async function init() {
    const supabase = await getSupabase();
    if (!supabase) return;

    initUploadService(supabase);
    updateState({ supabase });

    // Enforce saved theme accurately
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.className = 'ph ph-sun';
        const logo = document.getElementById('studioLogo');
        if (logo) logo.style.filter = 'invert(1)';
    }

    initAuthListener(async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        updateState({ currentUser: user });
        await loadData();
    }, () => {
        window.location.href = 'login.html';
    });
}

// ─── SETUP FLOW HELPERS ───
window.showSetupForm = (type) => {
    document.querySelector('.setup-cards-row').style.display = 'none';
    document.getElementById('setupForm').style.display = 'flex';
    document.getElementById('setupForm').classList.add('animate-fade');
};

window.goBackToSetupChoice = () => {
    document.querySelector('.setup-cards-row').style.display = 'grid';
    document.getElementById('setupForm').style.display = 'none';
};

window.generateSlugString = (name) => {
    return name
        .toLowerCase()
        .normalize('NFD') // handle accents
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

window.generateSlug = (name) => {
    const slug = window.generateSlugString(name);
    const viewer = document.getElementById('setupSlugPreview');
    const hiddenInput = document.getElementById('setupSlug');
    if (viewer) viewer.textContent = slug || '...';
    if (hiddenInput) hiddenInput.value = slug;
};

// ─── START ───
init();
