/**
 * dashboard.js - Zen Editor Entry
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import './modules/ui-handlers.js'; // Register global handlers
import { initAuthListener, getSupabase } from './auth-service.js';
import { initUploadService } from './upload-service.js';

async function init() {
    const supabase = await getSupabase();
    if (!supabase) return;

    initUploadService(supabase);
    updateState({ supabase });

    // Enforce theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.className = 'ph ph-sun';
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

// SETUP FLOW
window.generateSlugString = (name) => {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

window.generateSlug = (name) => {
    const slug = window.generateSlugString(name);
    const view = document.getElementById('slug-view');
    const input = document.getElementById('setupSlug');
    if (view) view.innerText = slug || '...';
    if (input) input.value = slug;
};

document.getElementById('setupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('setupName').value;
    const slug = document.getElementById('setupSlug').value;

    const { error } = await state.supabase.from('restaurants').insert([{
        owner_id: state.currentUser.id,
        name, slug,
        menu_type: 'digital',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }]);

    if (error) alert("Este link já existe ou houve um erro.");
    else window.location.reload();
});

init();
