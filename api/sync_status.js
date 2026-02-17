
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
            .select('id, stripe_customer_id, subscription_status, subscription_plan, trial_ends_at')
            .eq('owner_id', userId)
            .single();

        if (dbError || !currentDb) {
            console.error(`[SYNC] User/Restaurant not found via owner_id: ${userId}`);
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        let stripeCustomerId = currentDb.stripe_customer_id;
        let stripeSubscription = null;

        // 2. CASE A: We already have a Stripe Customer ID -> Check directly
        if (stripeCustomerId) {
            const subs = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                limit: 1,
            });
            // We look for 'active' or 'trialing'
            stripeSubscription = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        }

        // 3. CASE B: No Customer ID or No Active Sub found -> Search by Email Fallback
        if (!stripeSubscription) {
            console.log(`[SYNC] Searching by Email: ${email}`);
            const customers = await stripe.customers.list({
                email: email,
                limit: 1,
                expand: ['data.subscriptions'],
            });

            if (customers.data.length > 0) {
                const customer = customers.data[0];
                const subs = customer.subscriptions?.data || [];
                stripeSubscription = subs.find(s => s.status === 'active' || s.status === 'trialing');
                if (stripeSubscription) {
                    stripeCustomerId = customer.id;
                }
            }
        }

        // 4. UPDATE LOGIC
        if (stripeSubscription) {
            console.log(`[SYNC] FOUND STRIPE SUBSCRIPTION: ${stripeSubscription.status}`);

            const newStatus = stripeSubscription.status; // 'active' or 'trialing'

            // CRITICAL: If we found a Stripe subscription, the user is PRO.
            // We must clear trial_ends_at (internal trial) because they now have a real Stripe link.
            const updateData = {
                stripe_customer_id: stripeCustomerId,
                subscription_plan: 'pro',
                subscription_status: newStatus,
                trial_ends_at: null // DISABLE INTERNAL TRIAL - Stripe handles it now
            };

            // Only update if something changed
            if (currentDb.subscription_status !== newStatus || currentDb.stripe_customer_id !== stripeCustomerId || currentDb.trial_ends_at !== null) {
                console.log("[SYNC] Updating DB with Stripe Data...");
                await supabase.from('restaurants').update(updateData).eq('id', currentDb.id);
                return res.status(200).json({ status: newStatus, updated: true, source: 'stripe' });
            }

            return res.status(200).json({ status: newStatus, updated: false, source: 'stripe' });
        } else {
            console.log("[SYNC] No active Stripe subscription found. Keeping internal status.");
            return res.status(200).json({ status: currentDb.subscription_status, updated: false, source: 'internal' });
        }

    } catch (err) {
        console.error("[SYNC] Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
