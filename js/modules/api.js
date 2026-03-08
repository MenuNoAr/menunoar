/**
 * api.js - Zen Edition
 */
import { state, updateState } from './state.js';
import { renderAll, updateLiveLink } from './render.js';

export async function loadData() {
    const { supabase, currentUser } = state;
    if (!supabase || !currentUser) return;

    const { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

    if (error) return console.error('Error:', error);

    const setupEl = document.getElementById('setup-screen');
    if (!rest) {
        if (setupEl) setupEl.style.display = 'flex';
        return;
    }

    if (setupEl) setupEl.style.display = 'none';

    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', rest.id)
        .order('category')
        .order('name');

    updateState({
        restaurantId: rest.id,
        currentData: rest,
        menuItems: items || []
    });

    // Topbar updates
    const nameLabel = document.getElementById('sidebarUserName');
    if (nameLabel) nameLabel.innerText = rest.name || 'Menu';

    const userLabel = document.getElementById('userDisplayName');
    if (userLabel) userLabel.innerText = (rest.name || 'U').charAt(0).toUpperCase();

    renderAll();
    updateLiveLink(rest.slug);
}

export async function saveCategoryOrder(order) {
    await state.supabase.from('restaurants').update({ category_order: order }).eq('id', state.restaurantId);
}
