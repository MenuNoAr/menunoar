/**
 * api.js - Supabase & Server Interactions
 * Optimizations: parallel fetch (sync + items via Promise.allSettled),
 * single updateState call, removed redundant .limit(1).
 */
import { state, updateState } from './state.js';
import { renderHeader, renderMenu, renderPdfViewer, updateLiveLink } from './render.js';
import { initHeaderEditing } from './ui-handlers.js';

// ─── Load All Dashboard Data ──────────────────────────────────────────────────
export async function loadData() {
    const { supabase, currentUser } = state;
    if (!supabase || !currentUser) return;

    // Step 1: fetch restaurant (blocking – needed for everything else)
    const { data: restRaw, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('Erro ao carregar restaurante:', error.message);
        return;
    }

    // Step 2: show/hide UI
    if (!restRaw) {
        document.getElementById('setup-screen').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
        return;
    }

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('main-dashboard').style.display = 'block';

    // Step 3: sync status + fetch items in PARALLEL
    const [syncResult, itemsResult] = await Promise.allSettled([
        fetch('/api/sync_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, userId: currentUser.id }),
        }).then(r => (r.ok ? r.json() : null)).catch(() => null),

        supabase
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restRaw.id)
            .order('category')
            .order('name'),
    ]);

    // Re-fetch restaurant only if sync changed something
    let rest = restRaw;
    if (syncResult.status === 'fulfilled' && syncResult.value?.updated) {
        const { data: refreshed } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', rest.id)
            .maybeSingle();
        if (refreshed) rest = refreshed;
    }

    const items = itemsResult.status === 'fulfilled'
        ? (itemsResult.value.data ?? [])
        : [];

    // Single state update
    updateState({ restaurantId: rest.id, currentData: rest, menuItems: items });

    // Render all UI
    if (rest.menu_type === 'pdf') {
        renderPdfViewer(rest);
    } else {
        renderHeader(rest);
        renderMenu(items);
        initHeaderEditing();
    }

    updateLiveLink(rest.slug);
    _checkSubscription(rest);
    _updateTrialBadge(rest);
}

// ─── Subscription Display ─────────────────────────────────────────────────────
function _checkSubscription(rest) {
    const isActive = rest.subscription_status === 'active';
    const isPaidTrial = rest.subscription_status === 'trialing' && !!rest.stripe_customer_id;

    const planText = document.getElementById('currentPlanText');
    if (planText) {
        if (isActive || isPaidTrial) {
            planText.textContent = isActive
                ? 'Profissional (Membro Premium)'
                : 'Profissional (Teste Confirmado)';
            planText.style.color = '#16a34a';
        } else {
            const daysLeft = _daysLeft(rest.trial_ends_at);
            planText.textContent = daysLeft > 0
                ? `Teste Grátis (${daysLeft} dias restantes)`
                : 'Teste Expirado';
            planText.style.color = daysLeft > 0 ? '#16a34a' : '#ef4444';
        }
    }

    // Hide upgrade button for paying users
    if (isActive || isPaidTrial) {
        document.querySelector('a[href="subscription.html"]')?.style.setProperty('display', 'none');
    }

    // Show expired blocker
    if (!isActive && !isPaidTrial && _daysLeft(rest.trial_ends_at) <= 0) {
        const blocker = document.getElementById('expiredBlocker');
        if (blocker) blocker.style.display = 'flex';
    }
}

function _updateTrialBadge(rest) {
    const badge = document.getElementById('trialTimer');
    if (!badge) return;

    badge.className = 'trial-timer-badge';

    const isActive = rest.subscription_status === 'active' || !!rest.stripe_customer_id;
    const isTrial = rest.subscription_status === 'trialing' && !rest.stripe_customer_id;

    if (isActive) {
        badge.innerHTML = '<i class="fa-solid fa-crown"></i> PRO';
        badge.classList.add('state-pro');
        badge.style.display = 'inline-flex';
    } else if (isTrial) {
        const days = _daysLeft(rest.trial_ends_at);
        if (days > 0) {
            badge.innerHTML = `<i class="fa-solid fa-clock"></i> ${days} dias`;
            badge.classList.add('state-trial');
        } else {
            badge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Expirado';
            badge.classList.add('state-expired');
        }
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function _daysLeft(dateStr) {
    return Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
}

// ─── Category Order ───────────────────────────────────────────────────────────
export async function saveCategoryOrder(order) {
    const { error } = await state.supabase
        .from('restaurants')
        .update({ category_order: order })
        .eq('id', state.restaurantId);

    if (error) {
        console.error('Erro ao guardar ordem:', error.message);
        return;
    }

    state.currentData.category_order = order;
    renderMenu(state.menuItems);
}
