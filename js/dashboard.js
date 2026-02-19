/* dashboard.js - Unified Visual Editor Logic */
import { initUploadService, uploadFile } from './upload-service.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';

let supabase;
let currentUser;
let restaurantId;
let currentData = {}; // Store restaurant data
let menuItems = [];   // Store items
let currentSlideIndex = 0; // Store active slide
let activeCategoryName = null; // Store active category name to maintain selection
let sortableInstance = null; // Store SortableJS instance

// Function to initialize everything
async function init() {
    try {
        supabase = await getSupabase();
        if (!supabase) {
            console.error("Supabase fail");
            alert("Erro de conexão. Por favor recarregue a página.");
            return;
        }

        // Init upload service
        initUploadService(supabase);

        // Auth Listener
        initAuthListener(async (user) => {
            if (currentUser && currentUser.id === user.id) return;

            currentUser = user;
            const meta = user.user_metadata || {};
            let name = meta.full_name || meta.name;
            if (!name) {
                name = user.email.split('@')[0].replace(/[._]/g, ' ');
            }
            const initials = name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase();

            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) userDisplay.textContent = initials;

            await loadData();

            // Check if we just finished setup
            if (localStorage.getItem('just_created_rest') === 'true') {
                localStorage.removeItem('just_created_rest');
                setTimeout(() => {
                    // Start the new dynamic tutorial automatically!
                    if (window.confetti) {
                        confetti({
                            particleCount: 150,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#1fa8ff', '#16a34a', '#ffffff']
                        });
                    }
                    openTutorial();
                }, 1000);
            }
        }, () => {
            window.location.href = 'login.html';
        });
    } catch (err) {
        console.error("Init Error:", err);
    }
}

window.signOut = () => signOut();

// --- DATA LOADING & FLOW CONTROL ---
async function loadData() {
    // 1. Check for User Restaurant
    let { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Erro ao carregar dados:", error);
        return;
    }

    // 2. Flow Control
    if (!rest) {
        // Show Setup Screen
        document.getElementById('setup-screen').style.display = 'flex';
        document.getElementById('main-dashboard').style.display = 'none';
        return;
    } else {
        // Show Dashboard
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('main-dashboard').style.display = 'block';

        // 3. FORCE SYNC STATUS (Fixes Webhook Issues)
        try {
            console.log("Syncing subscription status for email:", currentUser.email);
            const syncRes = await fetch('/api/sync_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, userId: currentUser.id })
            });

            if (!syncRes.ok) {
                const errorText = await syncRes.text();
                console.error("[SYNC ERROR SERVER]", syncRes.status, errorText);
                throw new Error(`Erro no servidor (${syncRes.status})`);
            }

            const syncData = await syncRes.json();
            console.log("[SYNC RESULT]", syncData);

            if (syncData.updated) {
                console.log("[SYNC] Data was updated from Stripe. Reloading...");
                const { data: refreshed } = await supabase.from('restaurants').select('*').eq('owner_id', currentUser.id).maybeSingle();
                if (refreshed) rest = refreshed;
            }
        } catch (e) {
            console.warn("Sync temporarily unavailable or failed:", e);
            // Don't alert() here to avoid spamming the user, but log it.
        }
    }

    // 4. Load Dashboard Data
    restaurantId = rest.id;
    currentData = rest;
    renderHeader(rest);
    updateLiveLink(rest.slug);


    // --- SUBSCRIPTION UI CHECK ---
    const hasStripeId = !!rest.stripe_customer_id;
    const isStripeActive = rest.subscription_status === 'active';
    const isStripeTrial = rest.subscription_status === 'trialing' && hasStripeId;

    // If Active OR (Trialing AND Has Card Linked), we consider them "Premium Safe"
    if (isStripeActive || isStripeTrial) {
        // Find the "Teu Plano" section and update it
        const planText = document.getElementById('currentPlanText');
        if (planText) {
            if (isStripeActive) {
                planText.textContent = "Profissional (Membro Premium)";
            } else {
                planText.textContent = "Profissional (Teste Confirmado)";
            }
            planText.style.color = "#16a34a"; // Green check
        }

        // Hide Upgrade Button completely
        const upgradeBtn = document.querySelector('a[href="subscription.html"]');
        if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else {
        // User is NOT Premium (No active Stripe sub). Check internal trial.
        const daysLeft = Math.ceil((new Date(rest.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) {
            const blocker = document.getElementById('expiredBlocker');
            if (blocker) blocker.style.display = 'flex';
            // Optional: prevent fetching items if blocked
            // return; 
        }
    }

    // --- TRIAL TIMER IN NAVBAR ---
    const timerBadge = document.getElementById('trialTimer');
    if (timerBadge) {
        timerBadge.className = 'trial-timer-badge'; // Reset classes
        if (rest.subscription_status === 'trialing' && !rest.stripe_customer_id) {
            const daysLeft = Math.ceil((new Date(rest.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft > 0) {
                timerBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ${daysLeft} dias`;
                timerBadge.classList.add('state-trial');
                timerBadge.style.display = 'inline-flex';
            } else {
                timerBadge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Expirado`;
                timerBadge.classList.add('state-expired');
                timerBadge.style.display = 'inline-flex';
            }
        } else if (rest.subscription_status === 'active' || rest.stripe_customer_id) {
            timerBadge.innerHTML = `<i class="fa-solid fa-crown"></i> PRO`;
            timerBadge.classList.add('state-pro');
            timerBadge.style.display = 'inline-flex';
        } else {
            timerBadge.style.display = 'none';
        }
    }


    // Fetch Items
    const { data: items } = await supabase.from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category')
        .order('name');

    menuItems = items || [];
    renderMenu(menuItems);

    // Init editing listeners
    initHeaderEditing();
}

// --- SETUP WIZARD LOGIC ---
window.generateSlug = (name) => {
    const slug = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    document.getElementById('setupSlug').value = slug;
}

document.getElementById('setupForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Criar...';
    btn.disabled = true;

    const name = document.getElementById('setupName').value;
    const slug = document.getElementById('setupSlug').value;
    const desc = document.getElementById('setupDesc').value;
    const withDemo = document.getElementById('setupDemo').checked;

    // 1. Create Restaurant
    const newRest = {
        owner_id: currentUser.id,
        name: name,
        slug: slug,
        description: desc,
        menu_type: "digital",
        subscription_plan: 'pro',
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };

    const { data: created, error } = await supabase.from('restaurants').insert([newRest]).select().single();

    if (error) {
        alert("Erro ao criar: " + (error.code === '23505' ? 'Este link já existe. Escolha outro.' : error.message));
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    // 2. Add Demo Content
    if (withDemo && created) {
        const demoItems = [
            { restaurant_id: created.id, name: 'Bacalhau à Lagareiro', description: 'Lombo alto, batatas a murro e muito azeite.', price: 18.50, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Arroz de Marisco', description: 'Arroz malandrinho recheado de mar.', price: 22.00, category: 'Pratos Principais', available: true },
            { restaurant_id: created.id, name: 'Cheesecake', description: 'Delicioso com frutos vermelhos.', price: 4.50, category: 'Sobremesas', available: true },
            { restaurant_id: created.id, name: 'Limonada Caseira', description: 'Feita com limões do nosso quintal.', price: 3.00, category: 'Bebidas', available: true }
        ];
        await supabase.from('menu_items').insert(demoItems);
    }

    // 3. Set Flag and Reload
    localStorage.setItem('just_created_rest', 'true');
    window.location.reload();
};

// --- RENDERING ---

function updateLiveLink(slug) {
    const url = `${window.location.origin}/menu.html?id=${slug}`;
    const btn = document.getElementById('liveLinkBtn');
    if (btn) {
        btn.onclick = () => window.open(url, '_blank');
    }
    const link = document.getElementById('liveLink');
    if (link) link.href = url;
}

function renderHeader(data) {
    // Text
    document.getElementById('restNameEditor').textContent = data.name || "Nome do Restaurante";
    document.getElementById('restDescEditor').textContent = data.description || "Descrição curta (clica para editar)";

    // Cover
    const coverDiv = document.getElementById('coverEditor');
    let overlayContent = '';

    if (data.cover_url) {
        coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
        coverDiv.style.height = '350px';
        // Add Remove Button
        // Add Remove Button
        overlayContent = `
            <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
            <div style="position: absolute; top: 15px; right: 15px; z-index: 50;">
                <button class="action-btn btn-delete" onclick="deleteCover(); event.stopPropagation();" title="Remover Capa" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        coverDiv.style.backgroundImage = 'none';
        coverDiv.style.backgroundColor = 'var(--bg-page)';
        coverDiv.style.height = '120px'; // Reduced height for empty state
        overlayContent = `<div class="edit-overlay"><i class="fa-solid fa-camera"></i> Adicionar Capa</div>`;
    }

    // Rebuild content to include button
    coverDiv.innerHTML = overlayContent + `<input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">`;

    // Badges
    updateBadge('badgeWifi', 'textWifi', data.wifi_password, '📶 Wifi: ');
    updateBadge('badgePhone', 'textPhone', data.phone, '📞 ');
    updateBadge('badgeAddress', 'textAddress', data.address, '📍 ');
}

window.handleCoverUpload = async (input) => {
    if (!input.files.length) return;
    const file = input.files[0];
    const { data, error } = await uploadFile(file, 'cover');
    if (error) { alert("Erro ao fazer upload: " + error.message); return; }
    if (data) {
        await supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', restaurantId);
        loadData();
    }
};

window.deleteCover = async () => {
    if (confirm("Remover a capa do restaurante?")) {
        await supabase.from('restaurants').update({ cover_url: null }).eq('id', restaurantId);
        loadData();
    }
};

function updateBadge(badgeId, textId, value, prefix) {
    const el = document.getElementById(badgeId);
    const span = document.getElementById(textId);
    if (value) {
        span.textContent = value;
        el.style.opacity = '1';
    } else {
        span.textContent = "Adicionar...";
        el.style.opacity = '0.5';
    }
}

function renderMenu(items) {
    const container = document.getElementById('menuContainer');
    const nav = document.getElementById('categoryNav');

    // Clear previous content
    container.innerHTML = '<div id="editorTrack" class="slider-track" style="transition: transform 0.3s ease;"></div>';
    const track = document.getElementById('editorTrack');
    nav.className = 'category-tabs sticky-nav'; // Match menu.html class
    nav.innerHTML = '';

    // 1. Determine Category Order
    // Start with categories from items
    let uniqueCatsSet = new Set(items.map(i => i.category));

    // Add any empty categories that exist in the saved order
    if (currentData.category_order && Array.isArray(currentData.category_order)) {
        currentData.category_order.forEach(c => uniqueCatsSet.add(c));
    }

    let uniqueCats = Array.from(uniqueCatsSet);

    // If we have a saved order, respect it
    if (currentData.category_order && Array.isArray(currentData.category_order)) {
        const savedOrder = currentData.category_order;
        // Sort uniqueCats based on the index in savedOrder
        // Categories not in savedOrder go to the end
        uniqueCats.sort((a, b) => {
            const indexA = savedOrder.indexOf(a);
            const indexB = savedOrder.indexOf(b);
            const valA = indexA === -1 ? 999 : indexA;
            const valB = indexB === -1 ? 999 : indexB;
            return valA - valB;
        });
    }

    const groups = {};
    uniqueCats.forEach(c => {
        // Filter items for this category, defaulting to empty array if none
        groups[c] = items.filter(i => i.category === c);
    });

    // 2. Render Categories (Tabs & Slides)
    uniqueCats.forEach((cat, index) => {
        // --- NAV TAB (Draggable) ---
        const btn = document.createElement('div'); // Using div for drag convenience
        btn.className = 'tab-btn draggable-tab';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '2px';
        // Determine active state visually
        if (activeCategoryName) {
            if (cat === activeCategoryName) btn.classList.add('active');
        } else if (index === 0) {
            btn.classList.add('active');
            activeCategoryName = cat;
        }

        // Make whole button clickable
        btn.onclick = () => scrollToSlide(index);

        btn.innerHTML = `
            <span>${cat}</span>
            <div class="handle" style="padding: 15px 15px; margin: -10px -10px -10px -5px; cursor:grab; display:flex; align-items:center;">
                <i class="fa-solid fa-grip-lines-vertical" style="opacity:0.3; font-size: 0.9rem;"></i>
            </div>
        `;

        // Drag Attributes (Handled by SortableJS)
        btn.dataset.category = cat;
        btn.dataset.index = index;

        // Drag Events (Handled by SortableJS)

        nav.appendChild(btn);

        // --- SECTION SLIDE ---
        const section = document.createElement('div');
        section.id = `sec-${cat}`;
        section.className = 'menu-slide'; // Match menu.css
        section.style.minWidth = '100%'; // Force horizontal layout

        // Header (Editable)
        const catImages = currentData.category_images || {};
        let headerHTML = '';

        if (catImages[cat]) {
            headerHTML = `
                <div class="cat-banner editable-trigger" onclick="triggerCatUpload('${cat}')">
                    <img src="${catImages[cat]}" loading="lazy">
                    <div class="cat-banner-overlay">
                        <h2 contenteditable="true" spellcheck="false" class="inline-editable" onclick="event.stopPropagation();" onblur="handleCategoryRename('${cat}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${cat}</h2>
                    </div>
                    <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
                    <div style="position: absolute; top: 15px; right: 15px; z-index: 50;">
                        <button class="action-btn btn-delete" onclick="deleteCategory('${cat}'); event.stopPropagation();" title="Apagar Categoria" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <input type="file" id="upload-${cat.replace(/\s/g, '-')}" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*">
                </div>`;
        } else {
            headerHTML = `
                 <div class="slide-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <span contenteditable="true" spellcheck="false" class="text-editable inline-editable" onblur="handleCategoryRename('${cat}', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${cat}</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                         <label class="custom-file-upload" style="font-size:0.8rem; cursor:pointer; color:var(--primary);">
                            <i class="fa-solid fa-image"></i> Imagem
                            <input type="file" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*">
                        </label>
                        <button class="action-btn btn-delete" style="width:28px; height:28px; min-width:auto;" onclick="deleteCategory('${cat}')" title="Apagar Categoria"><i class="fa-solid fa-trash"></i></button>
                    </div>
                 </div>
            `;
        }

        // Items Grid
        let itemsHTML = groups[cat].map(item => createItemCard(item)).join('');

        // Add Item Button for this Category
        const addItemBtn = `
            <div class="add-item-btn" onclick="openAddItemModal('${cat}')">
                <span><i class="fa-solid fa-plus"></i> Adicionar Prato em "${cat}"</span>
            </div>
        `;

        section.innerHTML = headerHTML + `<div class="items-grid">${itemsHTML}</div>` + addItemBtn;
        track.appendChild(section);
    });

    // "Add Category" button in Nav
    const addCatBtn = document.createElement('button');
    addCatBtn.innerHTML = '<i class="fa-solid fa-plus"></i> <span style="margin-left: 5px;">Nova Categoria</span>';
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = addNewCategoryOptimized;
    nav.appendChild(addCatBtn);

    // Final spacer to ensure "Nova Categoria" isn't cut off by card edge
    const spacer = document.createElement('div');
    spacer.style.minWidth = '40px';
    spacer.style.height = '1px';
    nav.appendChild(spacer);

    // If we have an active category name, find its new index
    if (activeCategoryName) {
        const newIdx = uniqueCats.indexOf(activeCategoryName);
        if (newIdx !== -1) currentSlideIndex = newIdx;
    }

    // Initialize height for active slide
    setTimeout(() => scrollToSlide(currentSlideIndex, { instant: true }), 50);

    // --- INITIALIZE SORTABLEJS ---
    if (window.Sortable) {
        // Destroy previous instance if exists to avoid duplicates
        if (sortableInstance) {
            sortableInstance.destroy();
        }

        sortableInstance = new Sortable(nav, {
            animation: 150,
            handle: '.handle', // Drag handle
            draggable: '.draggable-tab', // Only drag tabs, not "add button"
            ghostClass: 'sortable-ghost', // Class for the drop placeholder
            chosenClass: 'sortable-chosen', // Class for the chosen item
            dragClass: 'sortable-drag', // Class for the dragging item
            onEnd: async function (evt) {
                // Save the new order
                const newOrder = [];
                // Query all tabs in the new order
                nav.querySelectorAll('.draggable-tab').forEach(tab => {
                    newOrder.push(tab.dataset.category);
                });

                console.log("SortableJS: Saving new order:", newOrder);
                await saveCategoryOrder(newOrder);

                // Correctly update slide index if the active tab moved
                // (Optional: Recalc currentSlideIndex based on active class)
                const newIndex = Array.from(nav.querySelectorAll('.tab-btn')).findIndex(btn => btn.classList.contains('active'));
                if (newIndex !== -1) currentSlideIndex = newIndex;
            }
        });
    }
}

// Global observer for dynamic height
let slideObserver = null;

// --- DRAG AND DROP LOGIC ---
// --- DRAG AND DROP LOGIC (Robust 2D) ---
function addDragEvents(item, allCats) {
    // Deprecated: SortableJS handles this now.
}

// Helper to calculate where to drop (2D Aware)
function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-tab:not(.dragging)')];

    let bestCandidate = null;
    let minDist = Number.POSITIVE_INFINITY;

    for (const child of draggableElements) {
        const box = child.getBoundingClientRect();
        // Distance to center
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;

        // Squared Euclidean distance
        const dist = (x - centerX) ** 2 + (y - centerY) ** 2;

        if (dist < minDist) {
            minDist = dist;
            bestCandidate = { element: child, centerX: centerX, centerY: centerY };
        }
    }

    if (!bestCandidate) return null;

    // Determine relative position
    // If to the right of the closest element, insert AFTER it
    if (x > bestCandidate.centerX) {
        return bestCandidate.element.nextElementSibling;
    } else {
        return bestCandidate.element;
    }
}

// Save Order to Supabase
// Save Order to Supabase
async function saveCategoryOrder(order) {
    const { error } = await supabase.from('restaurants')
        .update({ category_order: order })
        .eq('id', restaurantId);

    if (error) {
        console.error("Error saving order:", error);
    } else {
        currentData.category_order = order;
        // Don't reload full data to avoid flicker.
        // We just need to ensure the SLIDES track matches the TABS order.
        // However, since the tabs were reordered visually, the track indexes 
        // effectively changed relative to the tabs.
        // The simplest way to keep them in sync without full reload is actually
        // to re-render JUST the menu part, or accept the reload.
        // But invalidating the view is safer to avoid index mismatches.

        // Let's do a soft re-render of the menu container instead of full fetch
        renderMenu(menuItems);
    }
}

// Slider Navigation
window.scrollToSlide = (index, options = {}) => {
    const track = document.getElementById('editorTrack');
    if (!track || !track.children.length) return;

    // Clamp index
    if (index >= track.children.length) index = track.children.length - 1;
    if (index < 0) index = 0;

    currentSlideIndex = index; // Save state

    // Instant Jump or Smooth Scroll
    if (options.instant) {
        track.style.transition = 'none';
        track.style.transform = `translateX(-${index * 100}%)`;
        // Force reflow
        track.offsetHeight;
        // Restore transition for future slides (optional, or let next call handle it)
        setTimeout(() => { track.style.transition = 'transform 0.3s ease'; }, 50);
    } else {
        track.style.transition = 'transform 0.3s ease';
        track.style.transform = `translateX(-${index * 100}%)`;
    }

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
        // Warning: tab-btn includes the "add new" button which is last
        // and might not match track.children indices 1:1 if we count the btn-add-cat
        // But in renderMenu we add btn-add-cat to nav.
        // The track has N sections. Nav has N+1 buttons.
        // We only want to highlight the first N buttons.
        if (i === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Precise Tab Activation
    const tabs = document.querySelectorAll('.draggable-tab');
    tabs.forEach((t, i) => {
        if (i === index) {
            t.classList.add('active');
            activeCategoryName = t.dataset.category; // Save active category name
        }
        else t.classList.remove('active');
    });

    // --- Dynamic Height Logic ---
    const container = document.getElementById('menuContainer');
    const currentSlide = track.children[index];

    if (currentSlide) {
        // 1. Immediate set
        container.style.height = currentSlide.offsetHeight + 'px';

        // 2. Continuous watch (for images loading, added items, etc)
        if (slideObserver) slideObserver.disconnect();

        slideObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                container.style.height = entry.target.offsetHeight + 'px';
            }
        });

        slideObserver.observe(currentSlide);
    }
};

function createItemCard(item) {
    const isAvail = item.available;
    const eyeIcon = isAvail ? 'fa-eye' : 'fa-eye-slash';

    // Color: Green for visible, Muted Red/Gray for hidden to be very clear
    const eyeColor = isAvail ? 'var(--success)' : '#ccc';
    const opacity = isAvail ? '1' : '0.5';

    return `
        <div id="item-card-${item.id}" class="menu-item ${!isAvail ? 'unavailable' : ''} editable-container" style="position:relative; align-items:center;">
            
            <div class="item-text" style="flex:1;">
                <h3 contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${item.id}', 'name', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" style="margin-bottom:5px; display:inline-block;">${item.name}</h3>
                <p contenteditable="true" spellcheck="false" class="item-desc inline-editable" onblur="handleItemUpdate('${item.id}', 'description', this.innerText)" style="font-size:0.85rem; color:#666; margin-bottom:8px;">${item.description || ''}</p>
                
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="item-price" style="font-weight:700; display:flex; align-items:center;">
                        <span contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${item.id}', 'price', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${Number(item.price).toFixed(2)}</span>€
                    </div>
                    
                    <!-- Toggle moved next to price -->
                    <button class="btn-eye-toggle" onclick="toggleAvailability('${item.id}', ${isAvail}, this); event.stopPropagation();" title="Visibilidade" 
                            style="border:none; background:transparent; font-size:1rem; color:${eyeColor}; cursor:pointer; padding:5px; transition:transform 0.2s;">
                        <i class="fa-solid ${eyeIcon}"></i>
                    </button>
                     <button class="action-btn btn-delete" style="width:24px; height:24px; font-size:0.7rem;" onclick="deleteItem('${item.id}'); event.stopPropagation();" title="Apagar Prato">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="item-img" onclick="openImageModal('${item.id}')" style="cursor:pointer;">
                ${item.image_url
            ? `<img src="${item.image_url}">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eee; color:#bbb; font-size:1.5rem;"><i class="fa-solid fa-image"></i></div>`
        }
            </div>
        </div>
    `;
}

// --- ACTIONS & EVENTS ---

// Header Actions
// Header Actions
window.triggerCoverUpload = () => {
    const input = document.getElementById('coverUpload');
    if (input) input.click();
};

// Inline Editing Setup
function setupInlineEdit(elementId, fieldName) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false'); // Disable wavy lines
    el.classList.add('inline-editable');

    // Save on Blur (Focus Lost)
    el.addEventListener('blur', async () => {
        const newVal = el.innerText.trim();
        // Optimistic update already visible

        // Save to DB
        const update = {};
        update[fieldName] = newVal;
        await supabase.from('restaurants').update(update).eq('id', restaurantId);

        // Update local state
        currentData[fieldName] = newVal;
    });

    // Save on Enter (prevent newline for single line fields)
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
        }
    });
}

// Initialize Inline Editing for Badge Fields
// Note: Name/Desc initialized in renderHeader because they might re-render? 
// No, header is static in DOM structure mostly, but we can init once.
// Ideally call this after renderHeader or just once.
// Let's attach manually in renderHeader to be safe or just call globally if elements exist.

window.initHeaderEditing = () => {
    setupInlineEdit('restNameEditor', 'name');
    setupInlineEdit('restDescEditor', 'description');

    // Badges specific logic (they have spans inside)
    // Actually, let's target the inner spans for badges
    setupInlineEdit('textWifi', 'wifi_password');
    setupInlineEdit('textPhone', 'phone');
    setupInlineEdit('textAddress', 'address');
};


// Category Actions
window.triggerCatUpload = (cat) => {
    const input = document.getElementById(`upload-${cat.replace(/\s/g, '-')}`);
    if (input) input.click();
};

window.handleCatUpload = async (catName, input) => {
    if (!input.files.length) return;
    const file = input.files[0];

    // Clean cat name for safe file prefix
    const safeCatName = catName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    const { data, error } = await uploadFile(file, `cat-${safeCatName}`);
    if (error) { alert("Erro ao fazer upload: " + error.message); return; }

    if (data) {
        const newCats = { ...currentData.category_images, [catName]: data.publicUrl };
        await supabase.from('restaurants').update({ category_images: newCats }).eq('id', restaurantId);
        loadData();
    }
}



// Unified Category Rename Handler (Inline)
window.handleCategoryRename = async (oldName, newName) => {
    const val = newName.trim();
    if (!val || val === oldName) return; // No change

    // 1. Update Items
    const { error } = await supabase.from('menu_items')
        .update({ category: val })
        .eq('category', oldName)
        .eq('restaurant_id', restaurantId);

    if (error) {
        alert("Erro ao renomear: " + error.message);
        loadData(); // Revert UI
        return;
    }

    // 2. Update Image Key if exists
    if (currentData.category_images && currentData.category_images[oldName]) {
        const newImages = { ...currentData.category_images };
        newImages[val] = newImages[oldName];
        delete newImages[oldName];
        await supabase.from('restaurants').update({ category_images: newImages }).eq('id', restaurantId);
    }

    // 3. Update Order Array if exists
    if (currentData.category_order && currentData.category_order.includes(oldName)) {
        const newOrder = currentData.category_order.map(c => c === oldName ? val : c);
        await supabase.from('restaurants').update({ category_order: newOrder }).eq('id', restaurantId);
    }

    // Reload to refresh all bindings (simplest way to ensure consistency)
    loadData();
};

window.deleteCategory = async (catName) => {
    if (confirm(`Tens a certeza que queres apagar a categoria "${catName}" e TODOS os seus pratos?`)) {
        // 1. Delete Items
        await supabase.from('menu_items')
            .delete()
            .eq('category', catName)
            .eq('restaurant_id', restaurantId);

        // 2. Clean Image Key
        if (currentData.category_images && currentData.category_images[catName]) {
            const newImages = { ...currentData.category_images };
            delete newImages[catName];
            await supabase.from('restaurants').update({ category_images: newImages }).eq('id', restaurantId);
        }

        // 3. Clean Order Key (Critical for removing empty categories)
        if (currentData.category_order && currentData.category_order.includes(catName)) {
            const newOrder = currentData.category_order.filter(c => c !== catName);
            await supabase.from('restaurants').update({ category_order: newOrder }).eq('id', restaurantId);
        }

        loadData();
    }
};


// Item Actions
window.triggerItemImageUpload = (id) => document.getElementById(`item-upload-${id}`).click();
window.handleItemImageUpload = async (id, input) => {
    if (!input.files.length) return;
    const { data, error } = await uploadFile(input.files[0], `item-${id}`);
    if (error) { alert("Erro ao fazer upload: " + error.message); return; }
    if (data) {
        await supabase.from('menu_items').update({ image_url: data.publicUrl }).eq('id', id);
        loadData();
    }
}

window.toggleAvailability = async (id, currentStatus, btn) => {
    // Optimistic Update
    const newStatus = !currentStatus;
    const card = document.getElementById(`item-card-${id}`);

    // Update Local State
    const item = menuItems.find(i => i.id == id);
    if (item) item.available = newStatus;

    // UI Updates
    if (card) {
        if (newStatus) card.classList.remove('unavailable');
        else card.classList.add('unavailable');
    }

    // Button Update
    if (btn) {
        const icon = btn.querySelector('i');
        if (newStatus) {
            icon.className = 'fa-solid fa-eye';
            btn.style.color = 'var(--success)';
            btn.setAttribute('onclick', `toggleAvailability('${id}', true, this); event.stopPropagation();`);
        } else {
            icon.className = 'fa-solid fa-eye-slash';
            btn.style.color = '#ccc';
            btn.setAttribute('onclick', `toggleAvailability('${id}', false, this); event.stopPropagation();`);
        }
    }

    // Background DB Update
    await supabase.from('menu_items').update({ available: newStatus }).eq('id', id);
}

// Inline Item Update Handler
window.handleItemUpdate = async (id, field, value) => {
    let finalVal = value.trim();

    // Special handling for Price
    if (field === 'price') {
        finalVal = parseFloat(finalVal.replace(',', '.').replace(/[^0-9.]/g, ''));
        if (isNaN(finalVal)) {
            loadData(); // Revert invalid input
            return;
        }
    }

    const update = {};
    update[field] = finalVal;

    await supabase.from('menu_items').update(update).eq('id', id);
    // Don't full reload to verify small text changes, but updating local state is good practice
    // For simplicity and guaranteed sync, we can reload or just update local array
    const item = menuItems.find(i => i.id == id);
    if (item) item[field] = finalVal;

    // If price, we might want to re-format it in UI, so maybe reload isn't bad or just let it stay as typed until refresh
    if (field === 'price') loadData();
};

window.deleteItem = async (id) => {
    if (confirm("Tens a certeza que queres apagar este prato?")) {
        await supabase.from('menu_items').delete().eq('id', id);
        loadData();
    }
}


// --- MODALS ---

// Text Modal
// Add New Category (Simplified)
// Add New Category (Seamless Flow)
// Add New Category (Seamless Flow - No Modal)
window.addNewCategory = async () => {
    // Generate unique name
    let baseName = "Nova Categoria";
    let name = baseName;
    let counter = 1;

    // Check against ALL categories (both in items and in saved order)
    const existingCats = new Set(menuItems.map(i => i.category));
    if (currentData.category_order) currentData.category_order.forEach(c => existingCats.add(c));

    while (existingCats.has(name)) {
        counter++;
        name = `${baseName} ${counter}`;
    }

    // Update category_order to persist this "empty" category
    let newOrder = currentData.category_order || [];
    // Ensure we don't duplicate (though name check prevents it)
    if (!newOrder.includes(name)) {
        newOrder.push(name);
    }

    // --- INSTANT UI UPDATE (Optimistic) ---
    currentData.category_order = newOrder;
    renderMenu(menuItems);

    // Optimistic Update & Reload
    currentData.category_order = newOrder;
    // We don't need to reload from DB, just re-render
    // But loadData ensures total sync. Let's try loadData for safety.
    loadData();

    // Scroll to the end after a brief delay
    // Scroll to the end after a brief delay & Auto-Focus
    setTimeout(() => {
        const track = document.getElementById('editorTrack');
        if (track && track.children.length) {
            const lastIndex = track.children.length - 1;
            scrollToSlide(lastIndex);

            // Auto-focus and select text for renaming
            // Use a slightly longer delay to ensure the slide transition/render is settled
            setTimeout(() => {
                const lastSlide = track.children[lastIndex];
                if (!lastSlide) return;

                // Find either h2 or span that is the category name
                const editableHeader = lastSlide.querySelector('.inline-editable');

                if (editableHeader) {
                    editableHeader.focus();
                    // Select all text
                    const range = document.createRange();
                    range.selectNodeContents(editableHeader);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }, 300); // Wait for scroll animation to start/finish
        }
    }, 500);
};





/* --- IMAGE MODAL LOGIC --- */
let currentImageItemId = null;

window.openImageModal = (id) => {
    currentImageItemId = id;
    const item = menuItems.find(i => i.id == id);
    if (!item) return;

    const display = document.getElementById('imgPreviewDisplay');
    const placeholder = document.getElementById('imgPreviewPlaceholder');

    if (item.image_url) {
        display.src = item.image_url;
        display.style.display = 'block';
        placeholder.style.display = 'none';
        document.getElementById('btnRemoveImage').style.display = 'inline-flex';
    } else {
        display.style.display = 'none';
        placeholder.style.display = 'block';
        document.getElementById('btnRemoveImage').style.display = 'none';
    }

    closeAllModals();
    document.getElementById('imageModal').classList.add('open');
};

document.getElementById('btnChangeImage').onclick = () => {
    document.getElementById('modalImageUpload').click();
};

document.getElementById('modalImageUpload').onchange = async (e) => {
    if (!e.target.files.length || !currentImageItemId) return;

    const btn = document.getElementById('btnChangeImage');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    // Reuse existing upload handler logic
    await handleItemImageUpload(currentImageItemId, e.target);

    btn.innerHTML = original;
    btn.disabled = false;
    closeModal('imageModal');
};

document.getElementById('btnRemoveImage').onclick = async () => {
    if (!currentImageItemId) return;
    if (confirm("Remover imagem deste prato?")) {
        await supabase.from('menu_items').update({ image_url: null }).eq('id', currentImageItemId);
        closeModal('imageModal');
        loadData();
    }
};

// --- QR CODE ---
let qrCode = null;

window.openQrModal = () => {
    const modal = document.getElementById('qrModal');
    if (modal.classList.contains('open')) {
        closeModal('qrModal');
        return;
    }
    closeAllModals();
    modal.classList.add('open');

    // Generate QR if not exists or update it
    const url = `${window.location.origin}/menu.html?id=${currentData.slug}`;

    if (!qrCode) {
        // Wait for library to be ready if loaded async
        if (typeof QRCodeStyling === 'undefined') {
            alert("QR Code library loading... Try again in a second.");
            return;
        }

        qrCode = new QRCodeStyling({
            width: 300,
            height: 300,
            type: "svg",
            data: url,
            image: "assets/images/logo.svg",
            dotsOptions: {
                color: "#00B2FF",
                type: "rounded"
            },
            backgroundOptions: {
                color: "#ffffff",
            },
            imageOptions: {
                crossOrigin: "anonymous",
                margin: 10
            }
        });
        const container = document.getElementById('qr-code-container');
        container.innerHTML = '';
        qrCode.append(container);
    } else {
        qrCode.update({ data: url });
    }
}

window.downloadQr = () => {
    if (qrCode) qrCode.download({ name: `menu-${currentData.slug}-qr`, extension: "png" });
}

// Settings Modal
window.openSettingsModal = () => {
    const modal = document.getElementById('settingsModal');
    if (modal.classList.contains('open')) {
        closeModal('settingsModal');
        return;
    }

    document.getElementById('modalSlug').value = currentData.slug || '';
    document.getElementById('modalFont').value = currentData.font || 'Inter';

    // PDF Logic
    const isPdf = currentData.menu_type === 'pdf';
    document.getElementById('pdfToggle').checked = isPdf;
    togglePdfDetails();

    // Plan Logic
    const planText = document.getElementById('currentPlanText');
    if (planText) {
        const hasStripeId = !!currentData.stripe_customer_id;
        const status = currentData.subscription_status;

        if (hasStripeId && (status === 'active' || status === 'trialing')) {
            // STRIPE PREMIUM (Card already added)
            planText.textContent = "Profissional (Membro Premium)";
            planText.style.color = "#16a34a"; // Green
        } else if (status === 'trialing') {
            // INTERNAL FREE TRIAL (No card)
            const daysLeft = Math.ceil((new Date(currentData.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft > 0) {
                planText.textContent = `Teste Grátis (${daysLeft} dias restantes)`;
                planText.style.color = "#16a34a"; // Green
            } else {
                planText.textContent = "Teste Expirado";
                planText.style.color = "#ef4444"; // Red
            }
        } else if (status === 'active') {
            planText.textContent = "Profissional (Ativo)";
            planText.style.color = "#16a34a";
        } else {
            planText.textContent = currentData.subscription_plan === 'pro' ? "Profissional (" + status + ")" : "Sem Plano Ativo";
            planText.style.color = status === 'active' ? "#16a34a" : "#6b7280";
        }
    }

    closeAllModals();
    modal.classList.add('open');
}

window.togglePdfDetails = () => {
    const isPdf = document.getElementById('pdfToggle').checked;
    document.getElementById('pdfDetails').style.display = isPdf ? 'block' : 'none';
}

document.getElementById('settingsForm').onsubmit = async (e) => {
    e.preventDefault();

    const isPdf = document.getElementById('pdfToggle').checked;

    const updates = {
        slug: document.getElementById('modalSlug').value,
        font: document.getElementById('modalFont').value,
        menu_type: isPdf ? 'pdf' : 'digital'
    };

    // PDF Handling
    const pdfInput = document.getElementById('pdfUploadInput');
    if (pdfInput.files.length > 0) {
        // Use upload service, specifying bucket 'menu-pdfs'
        const { data, error } = await uploadFile(pdfInput.files[0], 'menu-pdf', 'menu-pdfs');
        if (error) { alert("Erro ao fazer upload do PDF: " + error.message); return; }
        if (data) {
            updates.pdf_url = data.publicUrl;
        }
    }

    await supabase.from('restaurants').update(updates).eq('id', restaurantId);
    alert("Configurações guardadas!");
    closeModal('settingsModal');
    loadData();
}


// Item Modal (Add/Edit)
window.openAddItemModal = (prefillCat = '') => {
    document.getElementById('editItemName').value = '';
    document.getElementById('editItemPrice').value = '';
    document.getElementById('editItemDesc').value = '';
    document.getElementById('editItemCat').value = prefillCat;
    document.getElementById('editItemId').value = ''; // Empty = Add
    document.getElementById('modalTitle').textContent = "Adicionar Prato";
    closeAllModals();
    document.getElementById('itemModal').classList.add('open');
}

window.openEditItemModal = (id) => {
    const item = menuItems.find(i => i.id == id);
    if (!item) return;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemDesc').value = item.description || '';
    document.getElementById('editItemCat').value = item.category;
    document.getElementById('editItemId').value = item.id;
    document.getElementById('modalTitle').textContent = "Editar Prato";
    closeAllModals();
    document.getElementById('itemModal').classList.add('open');
}

document.getElementById('itemEditForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const payload = {
        restaurant_id: restaurantId,
        name: document.getElementById('editItemName').value,
        price: parseFloat(document.getElementById('editItemPrice').value),
        description: document.getElementById('editItemDesc').value,
        category: document.getElementById('editItemCat').value,
        available: true // Default true on add
    };

    if (id) {
        // Update
        delete payload.restaurant_id; // Don't update parent
        delete payload.available; // Don't reset availability
        await supabase.from('menu_items').update(payload).eq('id', id);
    } else {
        // Insert
        await supabase.from('menu_items').insert([payload]);
    }
    closeModal('itemModal');
    loadData();
}


// Utils
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

window.closeAllModals = () => {
    document.querySelectorAll('.edit-modal').forEach(modal => modal.classList.remove('open'));
};

window.startEditing = () => {
    closeModal('trialSuccessModal');
    // Force a scroll to the top to ensure visibility
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Dark Mode logic reused
window.toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('menu_theme', isDark ? 'dark' : 'light');

    // Swap Logo
    const logo = document.getElementById('dashboardLogo');
    if (logo) {
        logo.src = isDark ? 'assets/images/Ilogo.svg' : 'assets/images/logo.svg';
    }

    // Swap Icon
    const btnIcon = document.getElementById('themeIcon');
    if (btnIcon) {
        btnIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

// --- OPTIMIZED NEW CATEGORY LOGIC ---
window.addNewCategoryOptimized = async () => {
    console.log("[OPTIMIZED] Adding new category...");
    // Generate unique name
    let baseName = "Nova Categoria";
    let name = baseName;
    let counter = 1;

    // Check against ALL categories (both in items and in saved order)
    const existingCats = new Set(menuItems.map(i => i.category));
    if (currentData.category_order) currentData.category_order.forEach(c => existingCats.add(c));

    while (existingCats.has(name)) {
        counter++;
        name = `${baseName} ${counter}`;
    }

    // Update category_order to persist this "empty" category
    let newOrder = currentData.category_order || [];
    // Ensure we don't duplicate (though name check prevents it)
    if (!newOrder.includes(name)) {
        newOrder.push(name);
    }

    // --- INSTANT UI UPDATE (Optimistic) ---
    currentData.category_order = newOrder;
    renderMenu(menuItems);

    // Scroll to the end INSTANTLY & Auto-Focus
    // Use a tiny timeout to let the DOM update from renderMenu
    setTimeout(() => {
        const track = document.getElementById('editorTrack');
        if (track && track.children.length) {
            const lastIndex = track.children.length - 1;

            // Instant scroll without animation
            scrollToSlide(lastIndex, { instant: true });

            // Auto-focus logic
            setTimeout(() => {
                const lastSlide = track.children[lastIndex];
                if (!lastSlide) return;

                // Find either h2 or span that is the category name
                const editableHeader = lastSlide.querySelector('.inline-editable');

                if (editableHeader) {
                    editableHeader.focus();
                    // Select all text
                    const range = document.createRange();
                    range.selectNodeContents(editableHeader);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }, 50);
        }
    }, 10);

    // --- BACKGROUND PERSIST ---
    const { error } = await supabase.from('restaurants')
        .update({ category_order: newOrder })
        .eq('id', restaurantId);

    if (error) {
        console.error("Error saving category:", error);
    }
};

// --- DYNAMIC INTERACTIVE TUTORIAL SYSTEM ---
let currentTutStep = 0;
const tutorialSteps = [
    {
        title: "Bem-vindo, Chef! 👋",
        text: "Este é o teu novo painel de controlo. Vamos mostrar-te como criar um menu incrível em segundos.",
        target: null, // Center
        icon: "fa-rocket"
    },
    {
        title: "Edição Instantânea ✍️",
        text: "Clica em qualquer texto (nome, descrição, preço) para o editares na hora. Tenta no nome do restaurante!",
        target: "#restNameEditor",
        icon: "fa-pencil"
    },
    {
        title: "Categorias 📂",
        text: "Organiza o teu menu por secções. Podes arrastar as abas para as reordenar como quiseres.",
        target: "#categoryNav",
        icon: "fa-layer-group"
    },
    {
        title: "Adicionar Pratos ✨",
        text: "Clica aqui para adicionar um prato novo na categoria que estás a ver.",
        target: ".add-item-btn", // This targets the first one, we'll ensure it's visible in renderStep
        icon: "fa-plus"
    },
    {
        title: "Personalização 🎨",
        text: "Aqui podes mudar o teu link (slug), as cores do menu e ativar o modo PDF.",
        target: "button[onclick='openSettingsModal()']",
        icon: "fa-gear"
    },
    {
        title: "Ver Resultado 🚀",
        text: "Clica aqui para veres como os teus clientes verão o teu menu live!",
        target: "#liveLinkBtn",
        icon: "fa-eye"
    }
];

window.openTutorial = () => {
    closeAllModals();
    currentTutStep = 0;

    // Remove existing if any
    const existing = document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow');
    existing.forEach(el => el.remove());

    renderStep(0);
};

function renderStep(index) {
    currentTutStep = index;
    const step = tutorialSteps[index];

    // 1. Create/Update Spotlight
    let spotlight = document.querySelector('.tutorial-spotlight');
    if (!spotlight) {
        spotlight = document.createElement('div');
        spotlight.className = 'tutorial-spotlight';
        document.body.appendChild(spotlight);
    }

    // 2. Create/Update Tooltip
    let tooltip = document.querySelector('.tutorial-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tutorial-tooltip';
        document.body.appendChild(tooltip);
    }

    // 3. Create/Update Arrow
    let arrow = document.querySelector('.tutorial-arrow');
    if (!arrow) {
        arrow = document.createElement('div');
        arrow.className = 'tutorial-arrow';
        arrow.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="var(--primary)"/></svg>`;
        document.body.appendChild(arrow);
    }

    // Update Tooltip Content FIRST so we can measure it
    tooltip.innerHTML = `
        <div class="tutorial-header">
            <h3><i class="fa-solid ${step.icon}"></i> ${step.title}</h3>
        </div>
        <p>${step.text}</p>
        <div class="tutorial-actions">
            <div class="tutorial-step-dots">
                ${tutorialSteps.map((_, i) => `<div class="tutorial-dot ${i === index ? 'active' : ''}"></div>`).join('')}
            </div>
            <div style="display:flex; gap:8px;">
                <button class="tutorial-btn-skip" onclick="closeTutorial()">Sair</button>
                ${index > 0 ? `<button class="tutorial-btn-next" style="background:var(--bg-page); color:var(--text); border:1px solid var(--border);" onclick="prevTutorialPage()">Anterior</button>` : ''}
                <button class="tutorial-btn-next" onclick="nextStep()">
                    ${index === tutorialSteps.length - 1 ? 'Começar!' : 'Próximo'}
                </button>
            </div>
        </div>
    `;

    const targetEl = step.target ? document.querySelector(step.target) : null;

    // Handle slider elements: if we target something inside the menu, go to first slide
    if (step.target === '.add-item-btn') {
        scrollToSlide(0, { instant: true });
    }

    if (targetEl) {
        // 1. Instant Scroll to target (removes travel lag)
        targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });

        // 2. Decide placement ONCE per step to avoid jumping
        const initialRect = targetEl.getBoundingClientRect();
        const placement = (initialRect.top > window.innerHeight / 2) ? 'above' : 'below';

        // 3. Continuous Sync
        let startTime = performance.now();
        const duration = 800;

        const syncPosition = (now) => {
            const rect = targetEl.getBoundingClientRect();
            const padding = 10;

            spotlight.style.opacity = '1';
            spotlight.style.left = `${rect.left - padding}px`;
            spotlight.style.top = `${rect.top - padding}px`;
            spotlight.style.width = `${rect.width + padding * 2}px`;
            spotlight.style.height = `${rect.height + padding * 2}px`;
            spotlight.style.display = 'block';
            spotlight.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.85)';

            positionTooltipAndArrow(rect, tooltip, arrow, placement);

            if (now - startTime < duration) {
                requestAnimationFrame(syncPosition);
            }
        };

        // Snap once synchronously to avoid any "starting from 0,0" or "sliding from previous step" lag
        syncPosition(startTime);
        requestAnimationFrame(syncPosition);
    } else {
        // Center position for welcome
        spotlight.style.opacity = '0';
        spotlight.style.display = 'none';

        tooltip.style.left = '50%';
        tooltip.style.top = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        arrow.style.opacity = '0';
    }

}

function positionTooltipAndArrow(rect, tooltip, arrow, placement) {
    const margin = 20;
    const arrowSize = 25;
    const tooltipHeight = tooltip.offsetHeight;
    const tooltipWidth = 320;

    let tooltipX, tooltipY, arrowX, arrowY, arrowRotate;

    // Horizontal centering relative to target
    tooltipX = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Bounds check horizontal
    if (tooltipX < 20) tooltipX = 20;
    if (tooltipX + tooltipWidth > window.innerWidth - 20) tooltipX = window.innerWidth - tooltipWidth - 20;

    if (placement === 'above') {
        tooltipY = rect.top - tooltipHeight - margin - 10;
        arrowX = rect.left + rect.width / 2 - 12;
        arrowY = rect.top - margin - 5;
        arrowRotate = 180;
    } else {
        tooltipY = rect.bottom + margin + 10;
        arrowX = rect.left + rect.width / 2 - 12;
        arrowY = rect.bottom + margin - 15;
        arrowRotate = 0;
    }

    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
    tooltip.style.transform = 'none';

    arrow.style.opacity = '1';
    arrow.style.left = `${arrowX}px`;
    arrow.style.top = `${arrowY}px`;
    arrow.style.transform = `rotate(${arrowRotate}deg)`;
}

window.nextStep = () => {
    if (currentTutStep < tutorialSteps.length - 1) {
        renderStep(currentTutStep + 1);
    } else {
        closeTutorial();
    }
};

window.closeTutorial = () => {
    const els = document.querySelectorAll('.tutorial-spotlight, .tutorial-tooltip, .tutorial-arrow');
    els.forEach(el => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    });
};

window.prevTutorialPage = () => {
    if (currentTutStep > 0) {
        renderStep(currentTutStep - 1);
    }
};


// Close modals on overlay click (using mousedown for faster/cleaner response)
document.addEventListener('mousedown', (event) => {
    if (event.target.classList.contains('edit-modal')) {
        closeAllModals();
    }
});

// Start
init();
