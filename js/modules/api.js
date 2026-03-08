/**
 * api.js - Supabase & Data Sync
 */
import { state, updateState } from './state.js';
import { renderHeader, renderMenu, renderPdfViewer, updateLiveLink } from './render.js';

export async function loadData() {
    const { supabase, currentUser } = state;
    if (!supabase || !currentUser) return;

    // Fetch Restaurant
    const { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

    if (error) return console.error('Error:', error);

    // Toggle Setup Screen
    const setupEl = document.getElementById('setup-screen');
    const mainEl = document.getElementById('main-dashboard');

    if (!rest) {
        if (setupEl) setupEl.style.display = 'flex';
        if (mainEl) mainEl.style.display = 'none';
        return;
    }

    // Fetch Menu Items
    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', rest.id)
        .order('category')
        .order('name');

    // Update State
    updateState({ restaurantId: rest.id, currentData: rest, menuItems: items || [] });

    // UI Updates
    if (setupEl) setupEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'flex'; // Use flex for the app-shell

    // User Info
    const userDisplay = document.getElementById('userDisplayName');
    if (userDisplay) userDisplay.textContent = (rest.name || currentUser.email || 'U').charAt(0).toUpperCase();

    const sidebarName = document.getElementById('sidebarUserName');
    if (sidebarName) sidebarName.textContent = rest.name || 'Restaurante';

    // Render Logic
    if (rest.menu_type === 'pdf') {
        renderPdfViewer(rest);
    } else {
        renderHeader(rest);
        renderMenu(items || []);
    }

    updateLiveLink(rest.slug);
    _updateTrialStatus(rest);
}

function _updateTrialStatus(rest) {
    const badge = document.getElementById('trialTimer');
    if (!badge) return;

    const trialEnds = new Date(rest.trial_ends_at);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24));

    if (rest.subscription_status === 'active') {
        badge.innerHTML = '<i class="ph-fill ph-check-circle"></i> PRO';
        badge.style.background = 'var(--success)';
        badge.style.display = 'flex';
    } else if (daysLeft > 0) {
        badge.innerHTML = `<i class="ph ph-clock"></i> ${daysLeft} dias trial`;
        badge.style.display = 'flex';
    } else {
        badge.innerHTML = '<i class="ph ph-warning-circle"></i> Expirado';
        badge.style.background = 'var(--danger)';
        badge.style.display = 'flex';
    }
}

export async function saveCategoryOrder(order) {
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    state.currentData.category_order = order;
}
