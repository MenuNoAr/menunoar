/**
 * dashboard.js - Entry Point & Global Handlers
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';
import { initUploadService, uploadFile } from './upload-service.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        initUploadService(supabase);
        updateState({ supabase });

        // Force theme from storage
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') document.body.classList.add('dark-mode');

        initAuthListener(async (user) => {
            if (state.currentUser?.id === user.id) return;
            updateState({ currentUser: user });
            await loadData();
        }, () => {
            window.location.href = 'login.html';
        });

    } catch (err) {
        console.error('Init Error:', err);
    }
}

// ─── Global Window Handlers ──────────────────────────────────────────────────
window.signOut = signOut;

window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');
window.closeAllModals = () => document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));

// Setup Logic
window.showSetupForm = (type) => {
    document.getElementById('setup-choice-card').style.display = 'none';
    document.getElementById(type === 'scratch' ? 'setup-form-card' : 'setup-import-card').style.display = 'block';
};

window.goBackToSetupChoice = () => {
    document.getElementById('setup-form-card').style.display = 'none';
    document.getElementById('setup-import-card').style.display = 'none';
    document.getElementById('setup-choice-card').style.display = 'block';
};

window.generateSlugString = (name) => {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
};

window.generateSlug = (name) => {
    const el = document.getElementById('setupSlug');
    if (el) el.value = window.generateSlugString(name);
};

// Form Post-Actions
document.getElementById('setupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner fa-spin"></i> Criando...';

    const name = document.getElementById('setupName').value;
    const slug = document.getElementById('setupSlug').value;

    const { error } = await state.supabase.from('restaurants').insert([{
        owner_id: state.currentUser.id,
        name, slug,
        menu_type: 'digital',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }]);

    if (error) {
        alert("Erro ao criar. Link talvez já exista.");
        btn.disabled = false;
        btn.textContent = "Finalizar Configuração";
    } else {
        window.location.reload();
    }
});

// Profile Actions
window.openProfileModal = () => {
    const data = state.currentData;
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profileEmail').value = state.currentUser.email || '';
    // Extra fields could be in user metadata or separate table
    document.getElementById('profileModal').classList.add('open');
};

// Toast Service
window.showToast = (msg, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast-notif ${type}`;
    toast.innerHTML = `<i class="ph-fill ph-${type === 'success' ? 'check-circle' : 'warning-circle'}"></i> <span>${msg}</span>`;

    // Quick and dirty styles for now or move to CSS
    Object.assign(toast.style, {
        position: 'fixed', bottom: '24px', right: '24px', padding: '12px 24px',
        background: type === 'success' ? '#10b981' : '#ef4444', color: '#fff',
        borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: '9999',
        animation: 'slideUp 0.4s ease forwards'
    });

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// Add animations if not in CSS
if (!document.getElementById('dashboard-anims')) {
    const s = document.createElement('style');
    s.id = 'dashboard-anims';
    s.innerHTML = `
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
    `;
    document.head.appendChild(s);
}

init();
