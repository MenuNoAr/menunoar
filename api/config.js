export default function handler(request, response) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return response.status(500).json({
            error: "Missing environment variables on server.",
            diagnostics: {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseAnonKey
            }
        });
    }

    response.status(200).json({
        supabaseUrl,
        supabaseAnonKey,
        stripePaymentLink: process.env.STRIPE_PAYMENT_LINK,
    });
}
