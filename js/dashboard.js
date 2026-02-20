/**
 * dashboard.js - Entry Point
 */
import { state, updateState } from './modules/state.js';
import { loadData } from './modules/api.js';
import { openTutorial } from './modules/tutorial.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';
import { initUploadService } from './upload-service.js';

// Initialize everything
async function init() {
    try {
        const supabase = await getSupabase();
        if (!supabase) return;

        initUploadService(supabase);
        updateState({ supabase });

        initAuthListener(async (user) => {
            if (state.currentUser?.id === user.id) return;
            updateState({ currentUser: user });

            // UI Initials
            const name = (user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]).replace(/[._]/g, ' ');
            const initials = name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) userDisplay.textContent = initials;

            await loadData();

            // Tutorial Trigger
            if (localStorage.getItem('just_created_rest') === 'true') {
                localStorage.removeItem('just_created_rest');
                setTimeout(() => {
                    if (window.confetti) {
                        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#1fa8ff', '#16a34a', '#ffffff'] });
                    }
                    openTutorial();
                }, 1000);
            }
        }, () => {
            window.location.href = 'login.html';
        });
    } catch (err) {
        console.error("Init Error:", err);
    }
}

// Global Exports for HTML onclicks
window.signOut = () => signOut();
window.openTutorial = openTutorial;
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('menu_theme', isDark ? 'dark' : 'light');
    document.getElementById('dashboardLogo').src = isDark ? 'assets/images/Ilogo.svg' : 'assets/images/logo.svg';
    document.getElementById('themeIcon').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
};

// Setup Wizard
window.generateSlug = (name) => {
    const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    document.getElementById('setupSlug').value = slug;
}

document.getElementById('setupForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Criar...';
    btn.disabled = true;

    const name = document.getElementById('setupName').value;
    const slug = document.getElementById('setupSlug').value;
    const desc = document.getElementById('setupDesc').value;
    const withDemo = document.getElementById('setupDemo').checked;

    const newRest = {
        owner_id: state.currentUser.id,
        name, slug, description: desc,
        menu_type: "digital",
        subscription_plan: 'pro',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data: created, error } = await state.supabase.from('restaurants').insert([newRest]).select().single();

    if (error) {
        alert("Erro ao criar: " + (error.code === '23505' ? 'Este link já existe. Escolha outro.' : error.message));
        btn.innerHTML = originalText; btn.disabled = false;
        return;
    }

    if (withDemo && created) {
        const demoItems = [
            { restaurant_id: created.id, name: 'Bacalhau à Lagareiro', description: 'Lombo alto, batatas a murro e muito azeite.', price: 18.50, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Arroz de Marisco', description: 'Arroz malandrinho recheado de mar.', price: 22.00, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Cheesecake', description: 'Delicioso com frutos vermelhos.', price: 4.50, category: 'Sobremesas', available: true },
            { restaurant_id: created.id, name: 'Limonada Caseira', description: 'Feita com limões do nosso quintal.', price: 3.00, category: 'Bebidas', available: true }
        ];
        await state.supabase.from('menu_items').insert(demoItems);
    }

    localStorage.setItem('just_created_rest', 'true');
    window.location.reload();
};

// Modals
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
window.closeAllModals = () => document.querySelectorAll('.edit-modal').forEach(modal => modal.classList.remove('open'));

document.addEventListener('mousedown', (event) => {
    if (event.target.classList.contains('edit-modal')) window.closeAllModals();
});

init();
