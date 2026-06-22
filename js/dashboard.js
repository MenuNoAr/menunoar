import { initAuthListener, signOut, getSupabase } from './auth-service.js';

function getDisplayName(user) {
    const rawName = user.user_metadata?.full_name
        ?? user.user_metadata?.name
        ?? user.email?.split('@')[0]
        ?? 'Utilizador';

    return rawName.replace(/[._]/g, ' ').trim();
}

function setAuthenticatedView(user) {
    const loading = document.getElementById('authLoading');
    const error = document.getElementById('authError');
    const shell = document.getElementById('dashboardShell');
    const userName = document.getElementById('userDisplayName');
    const userEmail = document.getElementById('userDisplayEmail');

    if (userName) userName.textContent = getDisplayName(user);
    if (userEmail) userEmail.textContent = user.email || '';

    if (loading) loading.hidden = true;
    if (error) error.hidden = true;
    if (shell) shell.hidden = false;
}

function setErrorState() {
    const loading = document.getElementById('authLoading');
    const error = document.getElementById('authError');
    const shell = document.getElementById('dashboardShell');

    if (loading) loading.hidden = true;
    if (shell) shell.hidden = true;
    if (error) error.hidden = false;
}

async function init() {
    try {
        const supabase = await getSupabase();
        if (!supabase) {
            setErrorState();
            return;
        }

        initAuthListener((user) => {
            setAuthenticatedView(user);
        }, () => {
            window.location.href = 'login.html';
        });
    } catch (error) {
        console.error('Dashboard init error:', error);
        setErrorState();
    }
}

window.signOut = () => signOut();

init();
