
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buffer } from 'micro';

// Disable default body parser for this route so we can get raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase Admin (Service Role) to bypass RLS
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Stripe requires the raw body to verify signature
        const buf = await buffer(req);
        event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook Signature/Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                // Payment successful
                const session = event.data.object;
                await handleCheckoutSessionCompleted(session);
                break;

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                // Subscription status changed (e.g. cancelled, payment failed)
                const subscription = event.data.object;
                await handleSubscriptionUpdated(subscription);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (err) {
        console.error(`Error processing event ${event.type}:`, err);
        return res.status(500).json({ error: 'Processing failed' });
    }

    res.json({ received: true });
}

async function handleCheckoutSessionCompleted(session) {
    const userId = session.client_reference_id;
    const customerId = session.customer;

    if (!userId) {
        console.log("No client_reference_id found in session. Might be a direct payment not from our app.");
        return;
    }

    console.log(`Processing subscription for user ${userId}`);

    // Update 'restaurants' table based on owner_id (which is userId from client_reference_id)
    const { error } = await supabase.from('restaurants')
        .update({
            subscription_plan: 'pro',
            subscription_status: 'active',
            stripe_customer_id: customerId
        })
        .eq('owner_id', userId);

    if (error) {
        console.error("Supabase update error:", error);
    } else {
        console.log("Updated subscription for user:", userId);
    }
}

async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status;

    // Map status: if active or trialing -> pro, else free
    const isValid = status === 'active' || status === 'trialing';
    const newPlan = isValid ? 'pro' : 'free';

    // We search by stripe_customer_id
    const { error } = await supabase.from('restaurants')
        .update({
            subscription_status: status,
            subscription_plan: newPlan
        })
        .eq('stripe_customer_id', customerId);

    if (error) console.error("Supabase update error:", error);
}
