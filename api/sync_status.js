
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // Garantir que devolvemos sempre JSON, mesmo em erro
    const sendError = (status, msg, debugData = {}) => {
        return res.status(status).json({ success: false, error: msg, debug: debugData });
    };

    if (req.method !== 'POST') return sendError(405, 'Método não permitido');

    const { email, userId } = req.body;
    if (!email || !userId) return sendError(400, 'Dados em falta (email ou userId)');

    try {
        console.log(`[SYNC] Iniciando sincronização para: ${email}`);

        // 1. Verificar se o utilizador existe na nossa DB
        const { data: restaurant, error: dbError } = await supabase
            .from('restaurants')
            .select('id, stripe_customer_id, subscription_status')
            .eq('owner_id', userId)
            .maybeSingle();

        if (dbError) return sendError(500, 'Erro na base de dados: ' + dbError.message);
        if (!restaurant) return sendError(404, 'Restaurante não encontrado na base de dados.');

        let stripeCustomerId = restaurant.stripe_customer_id;
        let foundSub = null;

        // 2. TENTAR ENCONTRAR PELO EMAIL (Caminho mais provável)
        const customers = await stripe.customers.list({ email: email, limit: 1 });

        if (customers.data.length > 0) {
            const customer = customers.data[0];
            stripeCustomerId = customer.id;

            // Listar subscrições deste cliente
            const subs = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                limit: 1,
                status: 'all' // Vamos filtrar manualmente para ter controle
            });

            foundSub = subs.data.find(s => s.status === 'active' || s.status === 'trialing');
        }

        // 3. SE NÃO ENCONTROU PELO EMAIL, TENTAR PELO ID (client_reference_id)
        if (!foundSub) {
            console.log("[SYNC] Sem subscrição por email. Verificando Checkout Sessions...");
            const sessions = await stripe.checkout.sessions.list({ limit: 20 });
            const session = sessions.data.find(s => s.client_reference_id === userId && s.status === 'complete');

            if (session && session.customer) {
                stripeCustomerId = session.customer;
                if (session.subscription) {
                    foundSub = await stripe.subscriptions.retrieve(session.subscription);
                }
            }
        }

        // 4. ATUALIZAR DB SE ENCONTROU
        if (foundSub && stripeCustomerId) {
            console.log(`[SYNC] ENCONTRADO! Status: ${foundSub.status}`);

            const { error: updateError } = await supabase.from('restaurants').update({
                stripe_customer_id: stripeCustomerId,
                subscription_status: foundSub.status,
                subscription_plan: 'pro',
                trial_ends_at: null // Mata o countdown do trial
            }).eq('owner_id', userId);

            if (updateError) return sendError(500, 'Erro ao atualizar DB: ' + updateError.message);

            return res.status(200).json({
                success: true,
                updated: true,
                status: foundSub.status
            });
        }

        // 5. SE CHEGOU AQUI, NÃO ENCONTROU NADA NO STRIPE
        return res.status(200).json({
            success: true,
            updated: false,
            message: 'Nenhum pagamento encontrado no Stripe.'
        });

    } catch (err) {
        console.error("[SYNC] Erro Fatal:", err);
        return sendError(500, 'Erro interno no servidor: ' + err.message);
    }
}
