const header = document.querySelector('[data-site-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileNav = document.querySelector('[data-mobile-nav]');

function syncHeader() {
    header?.classList.toggle('is-scrolled', window.scrollY > 12);
}

function closeMobileMenu() {
    if (!menuToggle || !mobileNav) return;

    mobileNav.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menu');
    menuToggle.innerHTML = '<i class="ph ph-list"></i>';
    header?.classList.remove('menu-visible');
    document.body.classList.remove('menu-open');
}

function toggleMobileMenu() {
    if (!menuToggle || !mobileNav) return;

    const shouldOpen = mobileNav.hidden;
    mobileNav.hidden = !shouldOpen;
    menuToggle.setAttribute('aria-expanded', String(shouldOpen));
    menuToggle.setAttribute('aria-label', shouldOpen ? 'Fechar menu' : 'Abrir menu');
    menuToggle.innerHTML = shouldOpen
        ? '<i class="ph ph-x"></i>'
        : '<i class="ph ph-list"></i>';
    header?.classList.toggle('menu-visible', shouldOpen);
    document.body.classList.toggle('menu-open', shouldOpen);
}

function initReveals() {
    const elements = document.querySelectorAll('.reveal:not(.is-visible)');

    if (!('IntersectionObserver' in window)) {
        elements.forEach((element) => element.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12,
    });

    elements.forEach((element) => observer.observe(element));
}

menuToggle?.addEventListener('click', toggleMobileMenu);
mobileNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

window.addEventListener('scroll', syncHeader, { passive: true });
window.addEventListener('resize', () => {
    if (window.innerWidth > 860) closeMobileMenu();
});

document.querySelectorAll('[data-current-year]').forEach((element) => {
    element.textContent = String(new Date().getFullYear());
});

syncHeader();
initReveals();
