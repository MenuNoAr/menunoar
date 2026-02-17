
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { email, userId } = req.body;
    if (!email || !userId) return res.status(400).json({ error: 'Missing Data' });

    let debug = {
        email_searched: email,
        userId: userId,
        stripe_customers_found: 0,
        subs_found: 0,
        errors: []
    };

    try {
        console.log(`[SYNC] Starting sync for ${email}`);

        // 1. Fetch current DB record
        const { data: currentDb, error: dbError } = await supabase
            .from('restaurants')
            .select('id, stripe_customer_id, subscription_status')
            .eq('owner_id', userId)
            .single();

        if (dbError) debug.errors.push("Supabase error: " + dbError.message);

        let stripeCustomerId = currentDb?.stripe_customer_id;
        let foundSub = null;

        // 2. SEARCH BY EMAIL (Fallback mais comum)
        console.log(`[SYNC] Searching Stripe Customers by email: ${email}`);
        const customers = await stripe.customers.list({
            email: email,
            limit: 5,
            expand: ['data.subscriptions']
        });

        debug.stripe_customers_found = customers.data.length;

        if (customers.data.length > 0) {
            for (const customer of customers.data) {
                const subs = customer.subscriptions?.data || [];
                const active = subs.find(s => s.status === 'active' || s.status === 'trialing');
                if (active) {
                    foundSub = active;
                    stripeCustomerId = customer.id;
                    debug.subs_found++;
                    break;
                }
            }
        }

        // 3. SEARCH BY SESSIONS (Se o email falhou, tentamos o ID de referência)
        if (!foundSub) {
            console.log(`[SYNC] No sub found by email. Checking recent sessions for userId: ${userId}`);
            const sessions = await stripe.checkout.sessions.list({
                limit: 10,
                expand: ['data.subscription']
            });

            const mySession = sessions.data.find(s => s.client_reference_id === userId && s.status === 'complete');
            if (mySession && mySession.customer) {
                stripeCustomerId = mySession.customer;
                // Get the subscription from session
                if (mySession.subscription) {
                    foundSub = typeof mySession.subscription === 'string'
                        ? await stripe.subscriptions.retrieve(mySession.subscription)
                        : mySession.subscription;
                    debug.subs_found++;
                }
            }
        }

        // 4. FINAL DECISION
        if (foundSub && stripeCustomerId) {
            console.log(`[SYNC] VALID SUB FOUND. Status: ${foundSub.status}`);

            const { error: updateError } = await supabase.from('restaurants').update({
                stripe_customer_id: stripeCustomerId,
                subscription_status: foundSub.status,
                subscription_plan: 'pro',
                trial_ends_at: null // DISABLE TRIAL
            }).eq('owner_id', userId);

            if (updateError) debug.errors.push("Update error: " + updateError.message);

            return res.status(200).json({
                success: true,
                updated: true,
                status: foundSub.status,
                debug: debug
            });
        }

        return res.status(200).json({
            success: true,
            updated: false,
            message: "Nenhuma subscrição ativa encontrada no Stripe para este utilizador.",
            debug: debug
        });

    } catch (err) {
        console.error("[SYNC] FATAL ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message,
            debug: debug
        });
    }
}
