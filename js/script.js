// Initialize Supabase
// IMPORTANTE: Para sites puramente estáticos (HTML/JS) no Vercel, as variáveis de ambiente normais (process.env) NÃO estão disponíveis no browser.
// Tens duas opções:
// 1. Colar as chaves diretamente aqui (A chave 'anon' é pública, por isso é seguro para este tipo de site).
// 2. Se quiseres mesmo usar Env Vars do Vercel, terias de usar uma Vercel Serverless Function para injetar estas chaves, o que é mais complexo.
// RECOMENDAÇÃO: Cola as chaves aqui. É seguro para a chave ANON.

let supabaseClient;

// Função para iniciar o Supabase buscando as keys ao servidor (Vercel)
async function initSupabase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Falha ao carregar configuração');

        const config = await response.json();

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.warn('Supabase keys em falta nas Environment Variables do Vercel.');
            return;
        }

        supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        console.log('Supabase initialized via Vercel Env Vars');
    } catch (error) {
        console.error('Erro a inicializar:', error);
    }
}

// Inicializar
initSupabase();

// Scroll Handling for Navbar Animation
// Scroll Handling for Navbar Animation (Desktop Only)
window.addEventListener('scroll', () => {
    // Only run on desktop
    if (!window.matchMedia("(min-width: 769px)").matches) return;

    // Se passarmos dos 50px de scroll, ativa o modo "scrolled" (encolhe)
    if (window.scrollY > 50) {
        document.body.classList.add('scrolled');
    } else {
        // Se voltarmos ao topo, volta ao normal
        document.body.classList.remove('scrolled');
    }

    // Curved Scroll Path Tracking
    updateScrollPath();
});

function updateScrollPath() {
    const path = document.getElementById('pathLineFg');
    const arrow = document.getElementById('scrollArrow');
    if (!path || !arrow) return;

    const length = path.getTotalLength();
    path.style.strokeDasharray = length;

    // Calculate progress: Hero center (0) to last section center
    // The container is 500vh, top starts at 50vh.
    const scrollStart = window.innerHeight * 0.5;
    const scrollEnd = window.innerHeight * 5.5; // Final section center at 5.5vh? 
    // Wait, hero=0, mockup=1, exp=2, bento=3, pricing=4, cta=5. 
    // Container starts at 50vh (hero center) and ends at 550vh (cta center).
    // Total height = 500vh.

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = Math.max(0, Math.min(1, window.scrollY / maxScroll));

    path.style.strokeDashoffset = length * (1 - scrollPercentage);

    // Position arrow
    const point = path.getPointAtLength(length * scrollPercentage);

    // Scale points (0-100 x 0-500) to actual container pixels
    const svgRect = path.parentElement.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;

    const x = (point.x / 100) * svgWidth;
    const y = (point.y / 500) * svgHeight;

    arrow.style.left = `${x}px`;
    arrow.style.top = `${y}px`;

    // Angle/Rotation calculation
    const nextPoint = path.getPointAtLength(Math.min(length, length * scrollPercentage + 1));

    // Convert SVG delta to pixel delta for accurate rotation
    const dx = (nextPoint.x - point.x) * (svgWidth / 100);
    const dy = (nextPoint.y - point.y) * (svgHeight / 500);

    const angle = Math.atan2(dy, dx);
    // Subtract 90 degrees because ph-arrow-down points downwards by default
    arrow.style.transform = `translate(-50%, -50%) rotate(${angle * 180 / Math.PI - 90}deg)`;
}

// Initial call
window.addEventListener('DOMContentLoaded', () => {
    updateScrollPath();
    initRevealObserver();
});
window.addEventListener('resize', updateScrollPath);

function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Scroll Handling for Links
function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Intercept clicks on links to use the centered scroll
document.addEventListener('DOMContentLoaded', () => {
    // Mobile Hamburger Menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const id = this.getAttribute('href').substring(1);
            scrollToSection(id);
        });
    });
});

// Form Handling
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!supabaseClient) {
            formStatus.textContent = 'Erro: Supabase ainda não carregou ou chaves em falta.';
            formStatus.style.color = 'red';
            // Tenta iniciar novamente caso tenha falhado
            await initSupabase();
            if (!supabaseClient) return;
        }

        const formData = new FormData(contactForm);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            service: formData.get('service'),
            created_at: new Date().toISOString()
        };

        formStatus.textContent = 'A enviar... Aguenta aí.';
        formStatus.style.color = 'orange';

        try {
            const { error } = await supabaseClient
                .from('contacts')
                .insert([data]);

            if (error) throw error;

            formStatus.textContent = 'Boa! Recebemos a tua mensagem. Vamos responder rápido!';
            formStatus.style.color = 'green';
            contactForm.reset();

        } catch (error) {
            console.error('Error submitting form:', error);
            formStatus.textContent = 'Ops! Algo correu mal. Tenta outra vez.';
            formStatus.style.color = 'red';
        }
    });
}
