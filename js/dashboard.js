/**
 * dashboard.js - The Command Center Hub Entry
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';
import { initUploadService } from './upload-service.js';

async function init() {
    const supabase = await getSupabase();
    if (!supabase) return;

    initUploadService(supabase);
    updateState({ supabase });

    initAuthListener(async (user) => {
        updateState({ currentUser: user });
        await loadData();
    }, () => {
        window.location.href = 'login.html';
    });
}

// ─── UTILS ───
window.signOut = signOut;
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
window.closeAllModals = () => document.querySelectorAll('.hub-modal-overlay').forEach(m => m.classList.remove('open'));

window.showSetupForm = (type) => {
    document.querySelector('.setup-grid').style.display = 'none';
    document.getElementById('setupForm').style.display = 'block';
};

window.goBackToSetupChoice = () => {
    document.querySelector('.setup-grid').style.display = 'grid';
    document.getElementById('setupForm').style.display = 'none';
};

window.generateSlugString = (name) => {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

window.generateSlug = (name) => {
    const el = document.getElementById('setupSlug');
    if (el) el.value = window.generateSlugString(name);
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

    if (error) alert("Erro ao criar restaurante.");
    else window.location.reload();
});

window.openProfileModal = () => {
    document.getElementById('profileEmail').textContent = state.currentUser.email;
    document.getElementById('profileModal').classList.add('open');
};

init();
