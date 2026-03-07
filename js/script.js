import { getSupabase } from './auth-service.js';

let supabaseClient;

// Função para iniciar o Supabase
async function initSupabase() {
    try {
        supabaseClient = await getSupabase();
        if (supabaseClient) {
            console.log('Supabase initialized successfully via auth-service');
        }
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
});


// Scroll Handling for Links
function scrollToSection(id) {
    const element = document.getElementById(id);
    if (element) {
        // "block: 'center'" faz com que o elemento fique no meio do ecrã
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
