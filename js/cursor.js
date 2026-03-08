/**
 * Premium Liquid Cursor System
 * Dot + Trail Ring for Menu no Ar
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Create cursor elements
    const dot = document.createElement('div');
    const ring = document.createElement('div');

    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';

    document.body.appendChild(dot);
    document.body.appendChild(ring);

    // 2. State management
    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let isHovering = false;
    let isMouseDown = false;

    // 3. Main mouse movement
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Immediate dot movement
        dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;

        // Dynamic hiding logic (only show when moving)
        dot.classList.add('is-active');
        ring.classList.add('is-active');
    });

    // 4. Smooth trail for the ring (requestAnimationFrame)
    function animate() {
        // Linear interpolation for smooth lag
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;

        ring.style.transform = `translate(${ringX}px, ${ringY}px)`;

        requestAnimationFrame(animate);
    }
    animate();

    // 5. Interaction states (Hover/Click)
    const interactiveElements = 'a, button, .btn, .card, .pricing-card, input, textarea, select, [role="button"]';

    const addListeners = (elements) => {
        elements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                isHovering = true;
                ring.classList.add('is-hovering');
                dot.classList.add('is-hovering');
            });
            el.addEventListener('mouseleave', () => {
                isHovering = false;
                ring.classList.remove('is-hovering');
                dot.classList.remove('is-hovering');
            });
        });
    };

    // Initial listeners
    addListeners(document.querySelectorAll(interactiveElements));

    // Handle dynamically added content (Dashboard menus etc)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element
                        if (node.matches && node.matches(interactiveElements)) {
                            addListeners([node]);
                        }
                        const children = node.querySelectorAll ? node.querySelectorAll(interactiveElements) : [];
                        if (children.length) addListeners(children);
                    }
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Click effect
    document.addEventListener('mousedown', () => {
        isMouseDown = true;
        ring.classList.add('is-clicking');
    });
    document.addEventListener('mouseup', () => {
        isMouseDown = false;
        ring.classList.remove('is-clicking');
    });

    // 6. Hide cursor when leaving window
    document.addEventListener('mouseleave', () => {
        dot.style.opacity = '0';
        ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
        dot.style.opacity = '1';
        ring.style.opacity = '1';
    });
});
