import { getSupabase } from './auth-service.js';

let supabaseClient;

// Initialize Supabase
async function initSupabase() {
    try {
        supabaseClient = await getSupabase();
        if (supabaseClient) {
            checkSessionAndNavigate();
        }
    } catch (error) {
        console.error('Erro a inicializar:', error);
    }
}

async function checkSessionAndNavigate() {
    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const navActions = document.getElementById('navActions');
        if (navActions) {
            navActions.innerHTML = `
                <a href="dashboard.html" class="btn btn-primary">
                    <i class="ph ph-layout"></i> Ir para Dashboard
                </a>
            `;
        }

        // Update hero buttons if they exist
        const heroBtnGroup = document.querySelector('.hero .flex');
        if (heroBtnGroup) {
            heroBtnGroup.innerHTML = `
                <a href="dashboard.html" class="btn btn-primary">
                    <i class="ph ph-layout"></i> Aceder ao meu Painel
                </a>
            `;
        }
    }
}

// Start
initSupabase();

// Scroll and Reveal
document.addEventListener('DOMContentLoaded', () => {
    // 1. Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const id = this.getAttribute('href').substring(1);
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // 2. Complex Intersection Animations (WorkOS pattern)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add the class that triggers the CSS animation
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once revealed to retain the state
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal, .reveal-blur, .reveal-shadow');
    revealElements.forEach(el => revealObserver.observe(el));
});
