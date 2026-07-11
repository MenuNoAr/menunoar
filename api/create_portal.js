import Stripe from 'stripe';
import { authenticateRequest, createSupabaseAdmin } from '../lib/server-auth.js';

const DEFAULT_RETURN_URL = 'https://menunoar.pt/dashboard.html';
const ALLOWED_RETURN_HOSTS = new Set(['menunoar.pt', 'www.menunoar.pt', 'menunoar-three.vercel.app']);

function getReturnUrl(value) {
    try {
        const url = new URL(value || DEFAULT_RETURN_URL);
        return url.protocol === 'https:' && ALLOWED_RETURN_HOSTS.has(url.hostname)
            ? url.toString()
            : DEFAULT_RETURN_URL;
    } catch {
        return DEFAULT_RETURN_URL;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const supabase = createSupabaseAdmin();
        const { user, error: authError } = await authenticateRequest(req, supabase);
        if (authError) return res.status(401).json({ error: authError });

        const { data: rest, error } = await supabase
            .from('restaurants')
            .select('stripe_customer_id')
            .eq('owner_id', user.id)
            .maybeSingle();

        if (error || !rest || !rest.stripe_customer_id) {
            return res.status(404).json({ error: 'Customer not found or no subscription active' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: rest.stripe_customer_id,
            return_url: getReturnUrl(req.body?.returnUrl),
        });

        res.status(200).json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
