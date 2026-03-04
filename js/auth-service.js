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
    if (!config || config.error) {
        console.error("Supabase Config Error:", config?.error || "Unknown error");
        return null;
    }

    // Helper to wait for global supabase to be ready (as it is loaded via script tag)
    const waitForSupabase = (timeout = 5000) => {
        return new Promise((resolve) => {
            if (window.supabase) return resolve(window.supabase);

            const start = Date.now();
            const interval = setInterval(() => {
                if (window.supabase) {
                    clearInterval(interval);
                    resolve(window.supabase);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, 100);
        });
    };

    const supabaseLib = await waitForSupabase();

    if (supabaseLib) {
        supabaseInstance = supabaseLib.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage
            }
        });
        configLoaded = true;
        return supabaseInstance;
    } else {
        console.error("Supabase JS library failed to load in time.");
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

    let initialCheckDone = false;

    sb.auth.onAuthStateChange((event, currentSession) => {
        // Events that imply a valid session
        const hasUser = !!currentSession?.user;

        if (hasUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
            if (onAuth) onAuth(currentSession.user);
            initialCheckDone = true;
        } else if (event === 'SIGNED_OUT') {
            if (onNoAuth) onNoAuth();
            initialCheckDone = true;
        }

        // Fallback for cases where no valid session is found on init
        if (!initialCheckDone && event === 'INITIAL_SESSION' && !hasUser) {
            if (onNoAuth) onNoAuth();
            initialCheckDone = true;
        }
    });

    // Fallback timeout in case onAuthStateChange is slow to fire (unlikely but safe)
    setTimeout(async () => {
        if (!initialCheckDone) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) {
                if (onAuth) onAuth(session.user);
            } else {
                if (onNoAuth) onNoAuth();
            }
            initialCheckDone = true;
        }
    }, 1500);
}

// Public access to instance getter for other scripts
export { getSupabase };
