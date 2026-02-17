/**
 * Auth Service - Centralizes Supabase Auth Logic
 */

let supabaseInstance = null;
let configLoaded = false;

let configPromise = null;

// Shared config fetcher
export async function getConfig() {
    if (!configPromise) {
        configPromise = fetch('/api/config').then(res => {
            if (!res.ok) throw new Error('Failed to load config');
            return res.json();
        }).catch(err => {
            console.error("Config Load Error:", err);
            return null;
        });
    }
    return configPromise;
}

// Initialize Supabase (Fetch config only once)
async function getSupabase() {
    if (supabaseInstance) return supabaseInstance;

    const config = await getConfig();
    if (!config) return null;

    if (window.supabase) {
        supabaseInstance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        configLoaded = true;
        return supabaseInstance;
    } else {
        console.error("Supabase JS not loaded");
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
