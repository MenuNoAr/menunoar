
import { initAuthListener, signOut, getConfig, getSupabase } from './auth-service.js';

let currentUser;
let stripeLink;

async function init() {
    console.log("Subscription Page Init");

    // Load Config
    try {
        const config = await getConfig();
        if (config) {
            stripeLink = config.stripePaymentLink;
        }
    } catch (err) {
        console.error("Config Error:", err);
    }

    // Auth Listener
    initAuthListener(async (user) => {
        currentUser = user;
        console.log("User Logged In:", user.email);

        // Check Subscription Status
        await checkSubscription(user);

    }, () => {
        // No Auth
        window.location.href = 'login.html';
    });
}

async function checkSubscription(user) {
    const supabase = await getSupabase();

    // Fetch Restaurant Data (Status & Trial End)
    // We select specific fields. Note: 'trial_ends_at' might be null.
    const { data: rest, error } = await supabase
        .from('restaurants')
        .select('subscription_status, trial_ends_at')
        .eq('owner_id', user.id)
        .maybeSingle();

    if (error) {
        console.error("Error fetching sub status:", error);
        return;
    }

    const btn = document.getElementById('stripeCheckoutBtn');
    const accentText = document.querySelector('.pricing-card p.text-accent') ||
        document.querySelector('.pricing-card p[style*="color: var(--accent)"]') ||
        document.querySelector('.pricing-card p'); // Fallback

    if (!btn || !rest) return;

    // --- LOGIC: HANDLE STATES ---

    // 1. ACTIVE (PAID) - Block everything
    if (rest.subscription_status === 'active') {
        renderActiveState(btn, accentText);
        return;
    }

    // 2. TRIALING
    if (rest.subscription_status === 'trialing') {
        const remainingDays = calculateDaysLeft(rest.trial_ends_at);

        if (remainingDays > 0) {
            // Still in Trial
            if (accentText) {
                accentText.innerHTML = `<strong>Teste Grátis Ativo</strong> (${remainingDays} dias restantes)`;
                accentText.style.color = 'var(--success)';
            }
            // Allow Upgrade
            btn.innerHTML = `<i class="fa-solid fa-rocket"></i> Confirmar Assinatura Oficial`;
        } else {
            // Trial Expired
            if (accentText) {
                accentText.innerHTML = `<strong>Teste Expirado!</strong>`;
                accentText.style.color = 'var(--danger)';
            }
            btn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Reativar Plano Agora`;
        }
    } else {
        // No Plan / Canceled / Free
        // Default State is fine (Subscrever Agora)
    }

    // --- CLICK HANDLER ---
    btn.onclick = (e) => {
        e.preventDefault();

        // If Active, do nothing (alert was already handled in renderActiveState if clicked, 
        // but we disabled it there. Just in case:)
        if (btn.disabled) return;

        if (!stripeLink) {
            alert("Erro: Link de pagamento indisponível.");
            return;
        }

        const params = new URLSearchParams();
        params.append('prefilled_email', currentUser.email);
        params.append('client_reference_id', currentUser.id);

        // Anti-cache & Session ID
        params.append('ts', Date.now());

        window.location.href = `${stripeLink}?${params.toString()}`;
    };
}

function renderActiveState(btn, textElement) {
    // Button
    btn.innerHTML = `<i class="fa-solid fa-check"></i> Plano Ativo`;
    btn.className = 'btn-secondary'; // Remove primary
    btn.style.cursor = 'default';
    btn.onclick = (e) => {
        e.preventDefault();
        alert("A tua subscrição já está ativa e segura!");
    };

    // Text
    if (textElement) {
        textElement.innerHTML = `<strong>Tudo desbloqueado!</strong> Aproveita o Menu no Ar.`;
        textElement.style.color = 'var(--success)';
    }
}

function calculateDaysLeft(dateString) {
    if (!dateString) return 0;
    const end = new Date(dateString);
    const now = new Date();
    // Difference in time
    const diff = end.getTime() - now.getTime();
    // Convert to days (ceil so 0.1 days counts as 1 day left)
    return Math.ceil(diff / (1000 * 3600 * 24));
}

// Start
init();
