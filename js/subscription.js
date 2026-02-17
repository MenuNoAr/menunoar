
import { initAuthListener, signOut, getConfig } from './auth-service.js';

let currentUser;
let stripeLink;

async function init() {
    console.log("Subscription Page Init");

    // Load Config
    const config = await getConfig();
    if (config) {
        stripeLink = config.stripePaymentLink;
    }

    // Auth Listener
    initAuthListener(async (user) => {
        currentUser = user;
        console.log("User Logged In:", user.email);
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
            if (!stripeLink) {
                alert("Erro: Link de pagamento não configurado.");
                return;
            }

            // Redirect to Stripe Payment Link
            window.location.href = `${stripeLink}?prefilled_email=${encodeURIComponent(currentUser.email)}`;
        };
    }
}

// Start
init();
