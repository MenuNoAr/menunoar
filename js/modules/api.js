/**
 * api.js - Supabase & Server Interactions
 */
import { state, updateState } from './state.js';
import { renderHeader, renderMenu, updateLiveLink } from './render.js';
import { initHeaderEditing } from './ui-handlers.js';

export async function loadData() {
    const { supabase, currentUser } = state;

    // 1. Fetch Restaurant Data (Essential first step)
    let { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar restaurante:", error);
        return;
    }

    // 2. Flow Control
    if (!rest) {
        document.getElementById('setup-screen').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
        return;
    }

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';

    // 3. Parallel Background Tasks: Sync Status & Fetch Items
    const [syncResult, itemsResult] = await Promise.allSettled([
        // Sync Task
        fetch('/api/sync_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, userId: currentUser.id })
        }).then(res => res.ok ? res.json() : null).catch(() => null),

        // Items Task
        supabase.from('menu_items')
            .select('*')
            .eq('restaurant_id', rest.id)
            .order('category')
            .order('name')
    ]);

    // Handle Sync Update if any
    if (syncResult.status === 'fulfilled' && syncResult.value?.updated) {
        const { data: refreshed } = await supabase.from('restaurants').select('*').eq('id', rest.id).maybeSingle();
        if (refreshed) rest = refreshed;
    }

    // Update State & Render
    updateState({
        restaurantId: rest.id,
        currentData: rest,
        menuItems: itemsResult.status === 'fulfilled' ? (itemsResult.value.data || []) : []
    });

    // UI Updates
    renderHeader(rest);
    renderMenu(state.menuItems);
    updateLiveLink(rest.slug);
    checkSubscription(rest);
    updateTrialTimer(rest);
    initHeaderEditing();
}

function checkSubscription(rest) {
    const hasStripeId = !!rest.stripe_customer_id;
    const isStripeActive = rest.subscription_status === 'active';
    const isStripeTrial = rest.subscription_status === 'trialing' && hasStripeId;

    if (isStripeActive || isStripeTrial) {
        const planText = document.getElementById('currentPlanText');
        if (planText) {
            planText.textContent = isStripeActive ? "Profissional (Membro Premium)" : "Profissional (Teste Confirmado)";
            planText.style.color = "#16a34a";
        }
        const upgradeBtn = document.querySelector('a[href="subscription.html"]');
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else {
        const daysLeft = Math.ceil((new Date(rest.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) {
            const blocker = document.getElementById('expiredBlocker');
            if (blocker) blocker.style.display = 'flex';
        }
    }
}

function updateTrialTimer(rest) {
    const timerBadge = document.getElementById('trialTimer');
    if (!timerBadge) return;

    timerBadge.className = 'trial-timer-badge';
    if (rest.subscription_status === 'trialing' && !rest.stripe_customer_id) {
        const daysLeft = Math.ceil((new Date(rest.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
            timerBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ${daysLeft} dias`;
            timerBadge.classList.add('state-trial');
            timerBadge.style.display = 'inline-flex';
        } else {
            timerBadge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Expirado`;
            timerBadge.classList.add('state-expired');
            timerBadge.style.display = 'inline-flex';
        }
    } else if (rest.subscription_status === 'active' || rest.stripe_customer_id) {
        timerBadge.innerHTML = `<i class="fa-solid fa-crown"></i> PRO`;
        timerBadge.classList.add('state-pro');
        timerBadge.style.display = 'inline-flex';
    } else {
        timerBadge.style.display = 'none';
    }
}

export async function saveCategoryOrder(order) {
    const { error } = await state.supabase.from('restaurants')
        .update({ category_order: order })
        .eq('id', state.restaurantId);

    if (!error) {
        state.currentData.category_order = order;
        renderMenu(state.menuItems);
    } else {
        console.error("Error saving order:", error);
    }
}
