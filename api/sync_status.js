
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

    try {
        console.log(`[SYNC] Syncing subscription for ${email}...`);

        // 1. Fetch current DB record
        const { data: currentDb, error: dbError } = await supabase
            .from('restaurants')
            .select('id, stripe_customer_id, subscription_status, subscription_plan')
            .eq('owner_id', userId)
            .single();

        if (dbError || !currentDb) {
            console.error(`[SYNC] User/Restaurant not found via owner_id: ${userId}`);
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        let customerId = currentDb.stripe_customer_id;
        let activeSubscription = null;

        // 2. CASE A: We already have a Stripe Customer ID -> Check directly
        if (customerId) {
            console.log(`[SYNC] Checking Stripe Customer ID: ${customerId}`);
            const subs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active', // Only care about Active (paid) or Trialing externally
                limit: 1,
            });
            if (subs.data.length > 0) activeSubscription = subs.data[0];

            // Note: If none found, we might want to check 'trialing' explicitly if status param behaves strictly
            if (!activeSubscription) {
                const trialing = await stripe.subscriptions.list({
                    customer: customerId,
                    status: 'trialing',
                    limit: 1,
                });
                if (trialing.data.length > 0) activeSubscription = trialing.data[0];
            }
        }

        // 3. CASE B: No Customer ID or No Active Sub found -> Search by Email Fallback
        // This is crucial if Webhook failed to link the customer initially.
        if (!activeSubscription) {
            console.log(`[SYNC] No active sub found by ID. Searching by Email: ${email}`);
            const customers = await stripe.customers.list({
                email: email,
                limit: 1,
                expand: ['data.subscriptions'],
            });

            if (customers.data.length > 0) {
                const customer = customers.data[0];
                console.log(`[SYNC] Found customer by email: ${customer.id}`);

                // Check subscriptions inside this customer object
                const subs = customer.subscriptions?.data || [];
                activeSubscription = subs.find(s => s.status === 'active' || s.status === 'trialing');

                if (activeSubscription) {
                    customerId = customer.id; // Assume this IS the correct customer now
                }
            }
        }

        // 4. DECISION LOGIC
        if (activeSubscription) {
            console.log(`[SYNC] FOUND ACTIVE SUBSCRIPTION: ${activeSubscription.status}`);

            // Verify if DB needs update
            const newStatus = activeSubscription.status; // 'active' or 'trialing'

            // Only update if inconsistent
            // Special Case: DB says 'trialing' (Internal Trial) but Stripe says 'active'. Update immediately.
            // Special Case: DB says 'trialing' (Internal) but Stripe says 'trialing'. Update trial_ends_at maybe?

            if (currentDb.subscription_status !== 'active' && newStatus === 'active') {
                console.log("[SYNC] Updating DB to ACTIVE PRO");
                await supabase.from('restaurants').update({
                    stripe_customer_id: customerId,
                    subscription_status: 'active',
                    subscription_plan: 'pro'
                }).eq('id', currentDb.id);

                return res.status(200).json({ status: 'active', updated: true });
            }
        } else {
            console.log("[SYNC] No active Stripe subscription found.");
            // Do NOT touch DB if it's 'trialing' internally. Don't break the free trial.
        }

        return res.status(200).json({ status: currentDb.subscription_status, updated: false });

    } catch (err) {
        console.error("[SYNC] Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
