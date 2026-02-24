import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
        const { userId, returnUrl } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: rest, error } = await supabase
            .from('restaurants')
            .select('stripe_customer_id')
            .eq('owner_id', userId)
            .maybeSingle();

        if (error || !rest || !rest.stripe_customer_id) {
            return res.status(404).json({ error: 'Customer not found or no subscription active' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: rest.stripe_customer_id,
            return_url: returnUrl || 'https://menunoar.pt/dashboard.html',
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
