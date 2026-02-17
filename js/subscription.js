
import { initAuthListener, signOut, getSupabase } from './auth-service.js';

let currentUser;

// CHANGE THIS: Your Stripe Payment Link
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_placeholder";

async function init() {
    console.log("Subscription Page Init");

    // Auth Listener
    initAuthListener(async (user) => {
        currentUser = user;
        console.log("User Logged In:", user.email);

        // Potential: Check if user already has a subscription via Supabase
        // const { data: sub } = await getSupabase().from('subscriptions').select('*').eq('user_id', user.id).single();
        // if (sub && sub.status === 'active') { showManageSubscription(); }

    }, () => {
        // No Auth
        window.location.href = 'login.html';
    });

    // Setup Button
    const btn = document.getElementById('stripeCheckoutBtn');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            if (!currentUser) return;

            // Redirect to Stripe Payment Link
            // Include user email as prefilled email in Stripe Checkout if possible
            // &prefilled_email=user@example.com (Stripe URL parameter)
            window.location.href = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(currentUser.email)}`;
        };
    }
}

// Start
init();
