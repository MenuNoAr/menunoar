/**
 * api.js - Hub Version
 */
import { state, updateState } from './state.js';
import { renderAll, updateLiveLink } from './render.js';

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

    // Update Global State
    updateState({
        restaurantId: rest.id,
        currentData: rest,
        menuItems: items || []
    });

    // Visibility
    if (setupEl) setupEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'flex';

    // UI Topbar updates
    const nameLabel = document.getElementById('sidebarUserName');
    if (nameLabel) nameLabel.textContent = rest.name || 'Restaurante';

    const userLabel = document.getElementById('userDisplayName');
    if (userLabel) userLabel.textContent = (rest.name || 'U').charAt(0).toUpperCase();

    // Trigger Complete Render
    renderAll();

    updateLiveLink(rest.slug);
    _updateStatusPill(rest);
}

function _updateStatusPill(rest) {
    const pill = document.getElementById('trialTimer');
    if (!pill) return;

    const isActive = rest.subscription_status === 'active';
    const trialEnds = new Date(rest.trial_ends_at);
    const days = Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24));

    if (isActive) {
        pill.textContent = 'Membro Pro';
        pill.className = 'status-pill pro';
        pill.style.background = '#000';
        pill.style.color = '#fff';
    } else if (days > 0) {
        pill.textContent = `${days} dias trial`;
        pill.className = 'status-pill trial';
    } else {
        pill.textContent = 'Trial Expirado';
        pill.className = 'status-pill expired';
        pill.style.background = '#ef4444';
        pill.style.color = '#fff';
    }
}

export async function saveCategoryOrder(order) {
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
    state.currentData.category_order = order;
}
