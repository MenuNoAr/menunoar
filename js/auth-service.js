/**
 * Auth Service - Centralizes Supabase Auth Logic
 */

let supabaseInstance = null;
let configLoaded = false;

// Initialize Supabase (Fetch config only once)
async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;

    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to load config');
        const config = await response.json();

        if (window.supabase) {
            supabaseInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            configLoaded = true;
            return supabaseInstance;
        } else {
            console.error("Supabase JS not loaded");
            return null;
        }
    } catch (e) {
        console.error("Auth Init Error:", e);
        return null;
    }
}

// Check if user is logged in
export async function getCurrentUser() {
    const sb = await getSupabase();
    if (!sb) return null;

    const { data: { session }, error } = await sb.auth.getSession();
    if (error || !session) return null;
    return session.user;
}

// Sign In with Email
export async function signIn(email, password) {
    const sb = await getSupabase();
    if (!sb) return { error: { message: "System error" } };

    return await sb.auth.signInWithPassword({
        email,
        password
    });
}

// Sign Up with Email
export async function signUp(email, password) {
    const sb = await getSupabase();
    if (!sb) return { error: { message: "System error" } };

    return await sb.auth.signUp({
        email,
        password
    });
}

// Sign In with Google
export async function signInWithGoogle() {
    const sb = await getSupabase();
    if (!sb) return { error: { message: "System error" } };

    return await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/dashboard.html'
        }
    });
}

// Sign Out
export async function signOut() {
    const sb = await getSupabase();
    if (sb) {
        await sb.auth.signOut();
        window.location.href = 'login.html';
    }
}

// Initialize Auth State Listener (for redirects)
export async function initAuthListener(onAuth, onNoAuth) {
    const sb = await getSupabase();
    if (!sb) return;

    sb.auth.onAuthStateChange((event, session) => {
        if (session) {
            if (onAuth) onAuth(session.user);
        } else {
            if (onNoAuth) onNoAuth();
        }
    });
}

// Public access to instance getter for other scripts
export { getSupabase };
