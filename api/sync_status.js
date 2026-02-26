
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req, res) {
    // Definir cabeçalho JSON logo no início
    res.setHeader('Content-Type', 'application/json');

    try {
        const { email, userId } = req.body || {};

        // Log básico para debug (Vercel logs)
        console.log("Request Body:", req.body);

        // Check Env Vars
        const config = {
            stripe: !!process.env.STRIPE_SECRET_KEY,
            supabaseUrl: !!process.env.SUPABASE_URL,
            supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        };

        if (!config.stripe || !config.supabaseUrl || !config.supabaseKey) {
            return res.status(500).json({
                success: false,
                error: "Configuração incompleta no servidor (Env Vars)",
                config: config
            });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Procurar restaurante
        const { data: rest, error: restError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', userId)
            .maybeSingle();

        if (restError) throw restError;
        if (!rest) return res.status(404).json({ success: false, error: "Restaurante não encontrado" });

        // 2. Procurar no Stripe
        let stripeSub = null;
        let customerId = rest.stripe_customer_id;

        // A. Se já temos customerId, procurar subscrições diretamente
        if (customerId) {
            const subs = await stripe.subscriptions.list({ customer: customerId, limit: 5 });
            stripeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        }

        // B. Se não temos customerId ou não encontramos subscrição, tentar por email
        if (!stripeSub && email) {
            const customers = await stripe.customers.list({ email: email, limit: 1 });
            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
                const subs = await stripe.subscriptions.list({ customer: customerId, limit: 5 });
                stripeSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
            }
        }

        // C. Fallback: Procurar em sessões recentes (apenas se ainda não encontramos)
        if (!stripeSub && userId) {
            const sessions = await stripe.checkout.sessions.list({ limit: 10 }); // Reduced limit
            const session = sessions.data.find(s => s.client_reference_id === userId && s.status === 'complete');
            if (session && session.customer) {
                customerId = session.customer;
                if (session.subscription) {
                    stripeSub = await stripe.subscriptions.retrieve(session.subscription);
                }
            }
        }

        // 3. Atualizar se encontrou algo novo
        if (stripeSub) {
            await supabase.from('restaurants').update({
                stripe_customer_id: customerId,
                subscription_status: stripeSub.status,
                subscription_plan: 'pro',
                trial_ends_at: null
            }).eq('id', rest.id);

            return res.status(200).json({ success: true, updated: true, status: stripeSub.status });
        }

        return res.status(200).json({ success: true, updated: false, message: "Sem subscrição no Stripe" });

    } catch (err) {
        console.error("FATAL ERROR:", err);
        return res.status(500).json({
            success: false,
            error: err.message || "Erro desconhecido",
            stack: err.stack
        });
    }
}
