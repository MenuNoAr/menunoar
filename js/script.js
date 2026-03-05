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
        const pathLength = svgPath.getTotalLength();
        svgPath.style.strokeDasharray = pathLength;
        svgPath.style.strokeDashoffset = pathLength;

        let lastScrollY = window.scrollY;
        let ticking = false;

        let containerHeight = 0;
        let containerTopOffset = 0;

        const measureContainer = () => {
            const container = document.querySelector('.curved-scroll-container');
            if (container) {
                containerHeight = container.offsetHeight;
                // Get initial distance from top of page
                const rect = container.getBoundingClientRect();
                containerTopOffset = rect.top + window.scrollY;
            }
        };

        const updateScrollProgress = () => {
            const currentScrollY = window.scrollY;
            const clientHeight = window.innerHeight;
            const centerOfScreen = currentScrollY + (clientHeight / 2);

            // Calculate progress 0.0 to 1.0 based on centerOfScreen relative to container
            let progress = (centerOfScreen - containerTopOffset) / containerHeight;
            progress = Math.min(Math.max(progress, 0), 1);

            svgPath.style.strokeDashoffset = pathLength - (progress * pathLength);

            const point = svgPath.getPointAtLength(progress * pathLength);
            const d = 0.5;
            const p1 = svgPath.getPointAtLength(Math.max(0, progress * pathLength - d));
            const p2 = svgPath.getPointAtLength(Math.min(pathLength, progress * pathLength + d));

            const ratioX = window.innerWidth / 100;
            const ratioY = containerHeight / 400;

            const dxScreen = (p2.x - p1.x) * ratioX;
            const dyScreen = (p2.y - p1.y) * ratioY;

            let angle = Math.atan2(dyScreen, dxScreen) * (180 / Math.PI);

            const isScrollingUp = currentScrollY < lastScrollY;
            lastScrollY = currentScrollY;

            if (isScrollingUp) {
                angle -= 180;
            }

            const xPercent = (point.x / 100) * 100;
            const yPercent = (point.y / 400) * 100;

            scrollArrow.style.setProperty('--arrow-left', xPercent + '%');
            scrollArrow.style.setProperty('--arrow-top', yPercent + '%');
            scrollArrow.style.setProperty('--arrow-angle', `${angle - 90}deg`);

            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollProgress);
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', () => {
            measureContainer();
            onScroll();
        });

        measureContainer();
        onScroll();
    }

    // 4. Smooth Navigation instead of custom Wheel Logic
    // We removed the wheel event listener that was blocking performance.
    // Native scrolling with CSS scroll-snap is much smoother.

});

