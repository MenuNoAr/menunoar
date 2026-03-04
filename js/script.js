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

    // 3. Curved Scroll Progress Line Logic
    const svgPath = document.getElementById('pathLineFg');
    const scrollArrow = document.getElementById('scrollArrow');

    if (svgPath && scrollArrow) {
        // Prepare the SVG path for drawing
        const pathLength = svgPath.getTotalLength();
        svgPath.style.strokeDasharray = pathLength;
        svgPath.style.strokeDashoffset = pathLength;

        const updateScrollProgress = () => {
            const container = document.querySelector('.curved-scroll-container');
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const clientHeight = window.innerHeight;

            // We measure progress as how much of the container has passed 
            // the middle of the screen (clientHeight / 2).
            const centerOfScreen = clientHeight / 2;
            const containerStart = rect.top;

            // Calculate progress 0.0 to 1.0
            let progress = (centerOfScreen - containerStart) / rect.height;
            progress = Math.min(Math.max(progress, 0), 1);

            // Draw the line
            svgPath.style.strokeDashoffset = pathLength - (progress * pathLength);

            // Move the arrow icon
            const point = svgPath.getPointAtLength(progress * pathLength);

            // point.x and point.y are relative to the viewBox "0 0 100 400"
            const xPercent = (point.x / 100) * 100;
            const yPercent = (point.y / 400) * 100;

            scrollArrow.style.left = xPercent + '%';
            scrollArrow.style.top = yPercent + '%';
        };

        window.addEventListener('scroll', updateScrollProgress, { passive: true });
        window.addEventListener('resize', updateScrollProgress);
        updateScrollProgress(); // init
    }
});
