import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        },
    );
}

export async function authenticateRequest(req, supabase = createSupabaseAdmin()) {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return { user: null, error: 'Unauthorized' };
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
        return { user: null, error: 'Unauthorized' };
    }

    return { user: data.user, error: null };
}
