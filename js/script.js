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
window.addEventListener('scroll', () => {
    // Ignore scroll effect on mobile to keep navbar static/compact
    if (window.innerWidth <= 768) return;

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
