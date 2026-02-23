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

            await loadData();

            // Fire tutorial + confetti after first restaurant creation (Scratch)
            if (localStorage.getItem('just_created_rest') === 'true') {
                localStorage.removeItem('just_created_rest');
                setTimeout(() => {
                    if (window.confetti) {
                        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#1fa8ff', '#16a34a', '#ffffff'] });
                    }
                    openTutorial();
                }, 1000);
            }

            // Fire ONLY confetti (no tutorial) for PDF imports
            if (localStorage.getItem('just_created_pdf') === 'true') {
                localStorage.removeItem('just_created_pdf');
                setTimeout(() => {
                    if (window.confetti) {
                        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#1fa8ff', '#ef4444', '#ffffff'] });
                    }
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
    window.closeModal('renameModal');
});

window.toggleDarkMode = () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('menu_theme', isDark ? 'dark' : 'light');
    document.getElementById('dashboardLogo').src = isDark
        ? 'assets/images/Ilogo.svg'
        : 'assets/images/logo.svg';
    document.getElementById('themeIcon').className = isDark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';
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
        alert("Por favor, selecione um ficheiro PDF.");
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }
    const file = fileInput.files[0];

    // Upload the file
    const { data: uploadData, error: uploadError } = await uploadFile(file, 'menu-pdf', 'menu-pdfs');

    if (uploadError) {
        alert('Erro ao carregar o PDF: ' + uploadError.message);
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
        alert('Erro ao criar restaurante. O link talvez já esteja em uso, tente outro nome.');
        btn.innerHTML = orig;
        btn.disabled = false;
        return;
    }

    alert('✅ Menu PDF criado com sucesso!');
    localStorage.setItem('just_created_pdf', 'true');
    window.location.reload();
});

document.getElementById('setupForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Criar...';
    btn.disabled = true;

    const name = document.getElementById('setupName').value.trim();
    const slug = document.getElementById('setupSlug').value.trim();
    const desc = document.getElementById('setupDesc').value.trim();
    const withDemo = document.getElementById('setupDemo').checked;

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

    if (withDemo && created) {
        await state.supabase.from('menu_items').insert([
            { restaurant_id: created.id, name: 'Bacalhau à Lagareiro', description: 'Lombo alto, batatas a murro e muito azeite.', price: 18.50, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Arroz de Marisco', description: 'Arroz malandrinho recheado de mar.', price: 22.00, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Cheesecake', description: 'Delicioso com frutos vermelhos.', price: 4.50, category: 'Sobremesas', available: true },
            { restaurant_id: created.id, name: 'Limonada Caseira', description: 'Feita com limões do nosso quintal.', price: 3.00, category: 'Bebidas', available: true },
        ]);
    }

    localStorage.setItem('just_created_rest', 'true');
    window.location.reload();
};

// ─── Modal Utilities ──────────────────────────────────────────────────────────
window.closeModal = (id) => document.getElementById(id)?.classList.remove('open');

window.closeAllModals = () =>
    document.querySelectorAll('.edit-modal').forEach(m => m.classList.remove('open'));

// Close modals on backdrop click
document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('edit-modal')) window.closeAllModals();
});

// ─── Start ────────────────────────────────────────────────────────────────────
init();
