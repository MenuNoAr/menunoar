
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
            // We append both email for prefilling AND client_reference_id for webhook matching
            const params = new URLSearchParams();
            params.append('prefilled_email', currentUser.email);

            // Standard Payment Links support 'client_reference_id' parameter
            params.append('client_reference_id', currentUser.id);

            window.location.href = `${stripeLink}?${params.toString()}`;
        };
    }
}

// Start
init();
