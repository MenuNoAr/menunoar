
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export default async function handler(req, res) {
    // Definir cabeçalho JSON logo no início
    res.setHeader('Content-Type', 'application/json');

    const sendError = (status, msg, detail = {}) => {
        console.error(`[SYNC ERROR] ${msg}`, detail);
        return res.status(status).json({
            success: false,
            error: msg,
            detail: detail.message || detail
        });
    };

    if (req.method !== 'POST') return sendError(405, 'Método não permitido');

    const { email, userId } = req.body;
    if (!email || !userId) return sendError(400, 'Dados em falta (email ou userId)');

    try {
        // Inicialização dentro do handler para capturar erros de env vars
        if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY em falta");
        if (!process.env.SUPABASE_URL) throw new Error("SUPABASE_URL em falta");
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY em falta");

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        console.log(`[SYNC] Sincronizando para ${email} (ID: ${userId})`);

        // 1. Verificar Restaurante
        const { data: restaurant, error: dbError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('owner_id', userId)
            .maybeSingle();

        if (dbError) return sendError(500, 'Erro na DB do Supabase', dbError);
        if (!restaurant) return sendError(404, 'Restaurante não encontrado');

        let foundSub = null;
        let customerId = restaurant.stripe_customer_id;

        // 2. Tentar por Email
        const customers = await stripe.customers.list({ email: email, limit: 1 });
        if (customers.data.length > 0) {
            const customer = customers.data[0];
            customerId = customer.id;
            const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 5 });
            foundSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        }

        // 3. Tentar por Session (client_reference_id)
        if (!foundSub) {
            const sessions = await stripe.checkout.sessions.list({ limit: 15 });
            const session = sessions.data.find(s => s.client_reference_id === userId && s.status === 'complete');
            if (session && session.customer) {
                customerId = session.customer;
                if (session.subscription) {
                    foundSub = await stripe.subscriptions.retrieve(session.subscription);
                }
            }
        }

        // 4. Resultado
        if (foundSub) {
            await supabase.from('restaurants').update({
                stripe_customer_id: customerId,
                subscription_status: foundSub.status,
                subscription_plan: 'pro',
                trial_ends_at: null
            }).eq('owner_id', userId);

            return res.status(200).json({ success: true, updated: true, status: foundSub.status });
        }

        return res.status(200).json({ success: true, updated: false, message: 'Nenhuma subscrição ativa encontrada.' });

    } catch (err) {
        return sendError(500, 'Erro Fatal no Servidor', err);
    }
}
