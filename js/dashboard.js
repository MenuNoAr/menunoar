/**
 * dashboard.js - Entry Point
 * Optimizations: early return guards, cleaner initials logic, no duplicate
 * loadData calls on auth re-fires for same user.
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import { openTutorial } from './modules/tutorial.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';
import { initUploadService, uploadFile } from './upload-service.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        initUploadService(supabase);
        updateState({ supabase });

        initAuthListener(async (user) => {
            // Skip re-init if same user is already loaded
            if (state.currentUser?.id === user.id) return;
            updateState({ currentUser: user });

            // Display first name in the navbar
            const rawName = user.user_metadata?.full_name
                ?? user.user_metadata?.name
                ?? user.email.split('@')[0];
            const cleanName = rawName.replace(/[._]/g, ' ').trim();

            // Use saved custom name if available, otherwise derive first name
            const savedName = localStorage.getItem('user_display_name');
            const firstName = savedName || cleanName.split(' ')[0];

            const el = document.getElementById('userDisplayName');
            if (el) el.textContent = firstName;

            const greetEl = document.getElementById('setupGreetingName');
            if (greetEl) greetEl.textContent = firstName + '!';

            const sidebarNameEl = document.getElementById('sidebarUserName');
            if (sidebarNameEl) sidebarNameEl.textContent = firstName;

            await loadData();

            // Fire tutorial + confetti after first restaurant creation
            if (localStorage.getItem('just_created_rest') === 'true') {
                localStorage.removeItem('just_created_rest');
                setTimeout(() => {
                    if (window.confetti) {
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#1fa8ff', '#16a34a', '#ffffff'],
                        });
                    }
                    if (state.currentData?.menu_type !== 'pdf') {
                        openTutorial();
                    }
                }, 1000);
            } else if (localStorage.getItem('tutorial_running') === 'true') {
                // Resume tutorial if it was running before a reload
                setTimeout(() => {
                    window.openTutorial(true);
                }, 1000);
            }
        }, () => {
            window.location.href = 'login.html';
        });

    } catch (err) {
        console.error('Init Error:', err);
    }
}

// ─── Global Helpers ───────────────────────────────────────────────────────────
window.signOut = () => signOut();
window.openTutorial = openTutorial;

window.openRenameModal = () => {
    const currentName = document.getElementById('userDisplayName')?.textContent || '';
    const input = document.getElementById('renameInput');
    if (input) input.value = currentName;
    document.getElementById('renameModal')?.classList.add('open');
    setTimeout(() => input?.focus(), 100);
};

document.getElementById('renameForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName) return;
    localStorage.setItem('user_display_name', newName);
    const el = document.getElementById('userDisplayName');
    if (el) el.textContent = newName;
    const greetEl = document.getElementById('setupGreetingName');
    if (greetEl) greetEl.textContent = newName + '!';

    const sidebarNameEl = document.getElementById('sidebarUserName');
    if (sidebarNameEl) sidebarNameEl.textContent = newName;

    window.closeModal('renameModal');
});

window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('menu_theme', isDark ? 'dark' : 'light');

    // Update Logos
    ['dashboardLogo', 'sidebarLogo', 'setupLogo', 'qrLogoImg'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // Only update QR logo if it's the default one
        if (id === 'qrLogoImg' && !el.src.includes('assets/images/logo.svg') && !el.src.includes('assets/images/Ilogo.svg')) return;
        el.src = isDark ? 'assets/images/Ilogo.svg' : 'assets/images/logo.svg';
    });



    // Update Desktop Icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';

    // Update Mobile Icon
    const themeIconMobile = document.getElementById('themeIconMobile');
    if (themeIconMobile) themeIconMobile.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
};

window.toggleNavDropdown = (forceClose = false) => {
    const dropbar = document.getElementById('mobileDropbar');
    const overlay = document.getElementById('mobileSidebarOverlay');
    const icon = document.getElementById('navMobileIcon');
    if (!dropbar) return;

    if (forceClose) {
        dropbar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
        if (icon) icon.className = 'fa-solid fa-bars-staggered';
        return;
    }

    const isOpen = dropbar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
    if (icon) {
        icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars-staggered';
    }
};

// ─── Toast Notification System ────────────────────────────────────────────────
window.showToast = (msg, type = 'success') => {
    let container = document.getElementById('toast-container');
    const isMobile = window.innerWidth <= 850;
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: isMobile ? 'auto' : '20px',
            bottom: isMobile ? '20px' : 'auto',
            right: isMobile ? '0' : '20px',
            left: isMobile ? '0' : 'auto',
            zIndex: '200000',
            display: 'flex', flexDirection: 'column', gap: '10px',
            alignItems: 'center', width: isMobile ? '100%' : 'auto'
        });
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    Object.assign(toast.style, {
        background: type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6'),
        color: '#fff', padding: '12px 20px', borderRadius: '12px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.2)', display: 'flex',
        alignItems: 'center', gap: '10px', fontWeight: '600', fontSize: '0.9rem',
        opacity: '0', transform: isMobile ? 'translateY(20px)' : 'translateX(100%)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', pointerEvents: 'none'
    });

    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = isMobile ? 'translateY(0)' : 'translateX(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = isMobile ? 'translateY(20px)' : 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
window.showSetupForm = (type) => {
    document.getElementById('setup-choice-card').style.display = 'none';
    if (type === 'scratch') {
        document.getElementById('setup-form-card').style.display = 'block';
    } else {
        document.getElementById('setup-import-card').style.display = 'block';
    }
};

window.goBackToSetupChoice = () => {
    document.getElementById('setup-form-card').style.display = 'none';
    document.getElementById('setup-import-card').style.display = 'none';
    document.getElementById('setup-choice-card').style.display = 'block';
};

window.generateSlugString = (name) => {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

window.generateSlug = (name) => {
    const slug = window.generateSlugString(name);
    const el = document.getElementById('setupSlug');
    if (el) el.value = slug;
};

document.getElementById('importForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A criar e carregar...';
    btn.disabled = true;

    const name = document.getElementById('importRestName').value.trim();
    let slug = window.generateSlugString(name);
    if (!slug) slug = 'menu-' + Math.floor(Math.random() * 10000);

    // Get the file
    const fileInput = document.getElementById('importFile');
    if (!fileInput.files.length) {
        window.showToast("Por favor, selecione um ficheiro PDF.", "error");
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }
    const file = fileInput.files[0];

    // Upload the file
    const { data: uploadData, error: uploadError } = await uploadFile(file, 'menu-pdf', 'menu-pdfs');

    if (uploadError) {
        window.showToast('Erro ao carregar o PDF: ' + uploadError.message, 'error');
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }

    const publicUrl = uploadData.publicUrl;

    const { data: created, error } = await state.supabase
        .from('restaurants')
        .insert([{
            owner_id: state.currentUser.id,
            name, slug,
            description: "O meu menu em PDF.",
            menu_type: 'pdf',
            pdf_url: publicUrl,
            subscription_plan: 'pro',
            subscription_status: 'trialing',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }])
        .select()
        .single();

    if (error) {
        window.showToast('Erro ao criar restaurante. O link talvez já esteja em uso, tente outro nome.', 'error');
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }

    window.showToast('Menu PDF criado com sucesso!', 'success');
    localStorage.setItem('just_created_rest', 'true');
    setTimeout(() => window.location.reload(), 2000);
});

document.getElementById('setupForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Criar...';
    btn.disabled = true;

    const name = document.getElementById('setupName').value.trim();
    let slug = window.generateSlugString(name);
    if (!slug) slug = 'menu-' + Math.floor(Math.random() * 10000);
    const desc = document.getElementById('setupDesc').value.trim();

    const { data: created, error } = await state.supabase
        .from('restaurants')
        .insert([{
            owner_id: state.currentUser.id,
            name, slug,
            description: desc,
            menu_type: 'digital',
            subscription_plan: 'pro',
            subscription_status: 'trialing',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }])
        .select()
        .single();

    if (error) {
        alert('Erro ao criar: ' + (
            error.code === '23505'
                ? 'Este link já existe. Escolha outro.'
                : error.message
        ));
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }

    localStorage.setItem('just_created_rest', 'true');
    window.location.reload();
};

// ─── Modal Utilities ──────────────────────────────────────────────────────────
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');

window.closeAllModals = () =>
    document.querySelectorAll('.edit-modal').forEach(m => m.classList.remove('open'));

// Close modals or dropbar on backdrop click
document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('edit-modal')) window.closeAllModals();

    // Close mobile dropbar if clicking outside
    const dropbar = document.getElementById('mobileDropbar');
    const trigger = document.querySelector('.mobile-nav-trigger');
    if (dropbar && dropbar.classList.contains('open') && !dropbar.contains(e.target) && !trigger.contains(e.target)) {
        window.toggleNavDropdown();
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
init();
