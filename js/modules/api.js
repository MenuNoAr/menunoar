/**
 * api.js - Studio Edition
 */
import { state, updateState } from './state.js';
import { renderAll, updateLiveLink } from './render.js';

export async function loadData() {
    const { supabase, currentUser } = state;
    if (!supabase || !currentUser) return;

    // Fetch Restaurant (Nike performance focus: parallelism where possible)
    const { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

    if (error) return console.error('Supabase Error:', error);

    const setupEl = document.getElementById('setup-screen');
    const mainEl = document.getElementById('main-dashboard');

    // Case: New User / No Restaurant
    if (!rest) {
        if (setupEl) setupEl.style.display = 'flex';
        if (mainEl) mainEl.style.display = 'none';
        _triggerSetupReveal();
        return;
    }

    // Fetch Menu Items
    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', rest.id)
        .order('category')
        .order('name');

    // Sync State
    updateState({
        restaurantId: rest.id,
        currentData: rest,
        menuItems: items || []
    });

    // Layout Transition
    if (setupEl) setupEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'flex';

    // UI Updates (Header & Branding)
    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) sidebarName.textContent = rest.name || 'Menu Studio';

    const userInitials = document.getElementById('userDisplayName');
    if (userInitials) userInitials.textContent = (rest.name || currentUser.email || 'U').charAt(0).toUpperCase();

    // Cinematic Rendering
    renderAll();

    updateLiveLink(rest.slug);
    _updateTrialStatus(rest);
}

function _updateTrialStatus(rest) {
    const badge = document.getElementById('trialTimer');
    if (!badge) return;

    const isActive = rest.subscription_status === 'active';
    const trialEnds = new Date(rest.trial_ends_at);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));

    if (isActive) {
        badge.innerHTML = '<i class="ph-fill ph-check-circle"></i> PREMIUM';
        badge.className = 'premium-badge pro';
    } else if (daysLeft > 0) {
        badge.innerHTML = `<i class="ph ph-lightning"></i> ${daysLeft}d Trial`;
        badge.className = 'premium-badge trial';
    } else {
        badge.innerHTML = '<i class="ph ph-warning"></i> Expirado';
        badge.className = 'premium-badge expired';
    }
}

function _triggerSetupReveal() {
    setTimeout(() => {
        const c = document.querySelector('.setup-container');
        if (c) c.classList.add('is-visible');
    }, 100);
}

export async function saveCategoryOrder(order) {
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    state.currentData.category_order = order;
}
