/* dashboard.js - Unified Visual Editor Logic */
import { initUploadService, uploadFile } from './upload-service.js';
import { initAuthListener, signOut, getSupabase } from './auth-service.js';

let supabase;
let currentUser;
let restaurantId;
let currentData = {}; // Store restaurant data
let menuItems = [];   // Store items
let currentSlideIndex = 0; // Store active slide

// Function to initialize everything
async function init() {
    supabase = await getSupabase();

    // Init upload service
    initUploadService(supabase);

    // Auth Listener
    initAuthListener(async (user) => {
        currentUser = user;
        document.getElementById('userDisplay').textContent = user.email.split('@')[0]; // Show part of email

        await loadData();

    }, () => {
        // No Auth
        window.location.href = 'login.html';
    });
}

window.signOut = () => signOut();

// --- DATA LOADING ---
async function loadData() {
    if (!currentUser) return;

    // Fetch Restaurant by OWNER ID (Supabase Auth ID)
    let { data: rest, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', currentUser.id)
        .single();

    // Auto-Create Restaurant if first time login
    if (!rest) {
        console.log("Utilizador novo, a criar restaurante...");
        const newRest = {
            owner_id: currentUser.id,
            name: "O Meu Restaurante",
            slug: "restaurante-" + Math.floor(Math.random() * 10000),
            description: "Edita esta descrição...",
            menu_type: "digital"
        };

        const { data: created, error: createError } = await supabase
            .from('restaurants')
            .insert([newRest])
            .select()
            .single();

        if (createError) {
            console.error("Erro ao criar restaurante inicial:", createError);
            alert("Erro ao iniciar a tua conta. Recarrega a página.");
            return;
        }
        rest = created;
    }

    if (rest) {
        restaurantId = rest.id;
        currentData = rest;
        renderHeader(rest);
        updateLiveLink(rest.slug);

        // Fetch Items
        const { data: items } = await supabase.from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order('category')
            .order('name');

        menuItems = items || [];

        // --- SEEDING LOGIC ---
        // Se a categoria "Pratos Principais" não existir, cria estes pratos automaticamente NA BASE DE DADOS
        const hasPratosPrincipais = menuItems.some(i => i.category === 'Pratos Principais');

        if (!hasPratosPrincipais && menuItems.length === 0) {
            console.log("Seeding Pratos Principais...");
            const demoItems = [
                { restaurant_id: restaurantId, name: 'Bacalhau à Lagareiro', description: 'Lombo alto, batatas a murro e muito azeite.', price: 18.50, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Arroz de Marisco', description: 'Arroz malandrinho recheado de mar.', price: 22.00, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Cheesecake', description: 'Delicioso com frutos vermelhos.', price: 4.50, category: 'Sobremesas', available: true }
            ];

            const { error: insertError } = await supabase.from('menu_items').insert(demoItems);

            if (!insertError) {
                // Recarregar para ter os IDs reais
                return loadData();
            }
        }

        renderMenu(menuItems);
    } else {
        document.getElementById('restNameEditor').textContent = "Erro ao carregar";
    }
}

// --- RENDERING ---

// --- RENDERING ---

function updateLiveLink(slug) {
    document.getElementById('liveLink').href = `${window.location.origin}/menu.html?id=${slug}`;
}

function renderHeader(data) {
    // Text
    document.getElementById('restNameEditor').textContent = data.name || "Nome do Restaurante";
    document.getElementById('restDescEditor').textContent = data.description || "Descrição curta (clica para editar)";

    // Cover
    const coverDiv = document.getElementById('coverEditor');
    if (data.cover_url) {
        coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
        coverDiv.style.height = '280px';
    } else {
        coverDiv.style.backgroundImage = 'none';
        coverDiv.style.backgroundColor = '#ddd';
        coverDiv.style.height = '150px'; // Smaller placeholder
    }

    // Badges
    updateBadge('badgeWifi', 'textWifi', data.wifi_password, '📶 Wifi: ');
    updateBadge('badgePhone', 'textPhone', data.phone, '📞 ');
    updateBadge('badgeAddress', 'textAddress', data.address, '📍 ');
}

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
    nav.innerHTML = '';

    // 1. Determine Category Order
    let uniqueCats = [...new Set(items.map(i => i.category))];

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
    uniqueCats.forEach(c => groups[c] = items.filter(i => i.category === c));

    // 2. Render Categories (Tabs & Slides)
    uniqueCats.forEach((cat, index) => {
        // --- NAV TAB (Draggable) ---
        const btn = document.createElement('div'); // Using div for drag convenience
        btn.className = 'tab-btn draggable-tab';
        if (index === 0) btn.classList.add('active');

        btn.innerHTML = `
            <span onclick="scrollToSlide(${index})">${cat}</span>
            <i class="fa-solid fa-grip-lines-vertical handle" style="margin-left:8px; opacity:0.3; cursor:grab;"></i>
        `;

        // Drag Attributes
        btn.setAttribute('draggable', 'true');
        btn.dataset.category = cat;
        btn.dataset.index = index;

        // Drag Events
        addDragEvents(btn, uniqueCats);

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
                <div class="cat-banner editable-container" onclick="triggerCatUpload('${cat}')">
                    <img src="${catImages[cat]}" loading="lazy">
                    <div class="cat-banner-overlay"><h2>${cat}</h2></div>
                    <div class="edit-icon-overlay"><i class="fa-solid fa-camera"></i> Capa | <i class="fa-solid fa-pen"></i> Nome</div>
                    <div class="item-actions" style="opacity:1; top:10px; right:10px;">
                        <button class="action-btn btn-edit" onclick="renameCategory('${cat}'); event.stopPropagation();" title="Renomear"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn btn-delete" onclick="deleteCategory('${cat}'); event.stopPropagation();" title="Apagar Categoria"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <input type="file" id="upload-${cat.replace(/\s/g, '-')}" onchange="handleCatUpload('${cat}', this)" style="display:none;" accept="image/*">
                </div>`;
        } else {
            headerHTML = `
                 <div class="slide-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="text-editable" onclick="renameCategory('${cat}')">${cat} <i class="fa-solid fa-pen" style="font-size:0.8rem; opacity:0.5;"></i></span>
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
    addCatBtn.innerHTML = '<i class="fa-solid fa-folder-plus"></i>';
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = addNewCategory;
    nav.appendChild(addCatBtn);

    // Initialize height for active slide
    setTimeout(() => scrollToSlide(currentSlideIndex), 50);
}

// Global observer for dynamic height
let slideObserver = null;

// --- DRAG AND DROP LOGIC ---
function addDragEvents(item, allCats) {
    item.addEventListener('dragstart', (e) => {
        e.target.classList.add('dragging');
        // Store the category name being dragged
        e.dataTransfer.setData('text/plain', item.dataset.category);
    });

    item.addEventListener('dragend', async (e) => {
        e.target.classList.remove('dragging');

        // Save the new order
        const nav = document.getElementById('categoryNav');
        const newOrder = [];
        // Only get the category tabs, ignore "add button"
        nav.querySelectorAll('.draggable-tab').forEach(tab => {
            newOrder.push(tab.dataset.category);
        });

        console.log("Saving new order:", newOrder);
        await saveCategoryOrder(newOrder);
    });

    // Allow dropping on the navigation container
    const nav = document.getElementById('categoryNav');
    nav.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(nav, e.clientX);
        const draggable = document.querySelector('.dragging');
        if (!draggable) return;

        // "Add Cat" button should always be last, so insert before it if possible
        const addBtn = document.querySelector('.btn-add-cat');

        if (afterElement == null) {
            nav.insertBefore(draggable, addBtn);
        } else {
            nav.insertBefore(draggable, afterElement);
        }
    });
}

// Helper to calculate where to drop
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.draggable-tab:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        // Check center point
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save Order to Supabase
async function saveCategoryOrder(order) {
    const { error } = await supabase.from('restaurants')
        .update({ category_order: order })
        .eq('id', restaurantId);

    if (error) {
        console.error("Error saving order:", error);
    } else {
        currentData.category_order = order;
        // Re-render handled by drag event merely moving DOM, 
        // but let's reload to ensure logic sync (simpler) or just update internal state
        // Ideally we don't full reload to not jar functionality, but let's re-render
        // to sync the SLIDER track order with the TABS order.
        loadData();
    }
}

// Slider Navigation
window.scrollToSlide = (index) => {
    const track = document.getElementById('editorTrack');
    if (!track || !track.children.length) return;

    // Clamp index
    if (index >= track.children.length) index = track.children.length - 1;
    if (index < 0) index = 0;

    currentSlideIndex = index; // Save state

    track.style.transform = `translateX(-${index * 100}%)`;

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
        if (i === index) t.classList.add('active');
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
    return `
        <div class="menu-item ${!isAvail ? 'unavailable' : ''} editable-container" style="position:relative;">
            
            <div class="item-actions">
                <button class="action-btn btn-trigger ${isAvail ? 'btn-toggle' : 'btn-toggle off'}" onclick="toggleAvailability('${item.id}', ${isAvail})" title="Disponibilidade">
                   ${isAvail ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>'}
                </button>
                <button class="action-btn btn-edit" onclick="openEditItemModal('${item.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn btn-delete" onclick="deleteItem('${item.id}')" title="Apagar"><i class="fa-solid fa-trash"></i></button>
            </div>

            <div class="item-text" onclick="openEditItemModal('${item.id}')">
                <h3>${item.name}</h3>
                <p class="item-desc">${item.description || ''}</p>
                <div class="item-price">${Number(item.price).toFixed(2)}€</div>
            </div>
            
            <div class="item-img" onclick="triggerItemImageUpload('${item.id}')">
                ${item.image_url
            ? `<img src="${item.image_url}">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eee; color:#bbb; font-size:2rem;"><i class="fa-solid fa-image"></i></div>`
        }
                <div class="edit-icon-overlay"><i class="fa-solid fa-camera"></i></div>
                <input type="file" id="item-upload-${item.id}" onchange="handleItemImageUpload('${item.id}', this)" style="display:none;" accept="image/*">
            </div>
        </div>
    `;
}

// --- ACTIONS & EVENTS ---

// Header Actions
window.triggerCoverUpload = () => document.getElementById('coverUpload').click();
document.getElementById('coverUpload').addEventListener('change', async (e) => {
    if (!e.target.files.length) return;
    const file = e.target.files[0];
    const { data, error } = await uploadFile(file, 'cover');
    if (error) { alert("Erro ao fazer upload: " + error.message); return; }
    if (data) {
        await supabase.from('restaurants').update({ cover_url: data.publicUrl }).eq('id', restaurantId);
        loadData();
    }
});

window.editRestName = () => openTextModal("Nome do Restaurante", currentData.name, async (val) => {
    await supabase.from('restaurants').update({ name: val }).eq('id', restaurantId);
    loadData();
});

window.editRestDesc = () => openTextModal("Descrição", currentData.description, async (val) => {
    await supabase.from('restaurants').update({ description: val }).eq('id', restaurantId);
    loadData();
});

window.editWifi = () => openTextModal("Password Wifi", currentData.wifi_password, async (val) => {
    await supabase.from('restaurants').update({ wifi_password: val }).eq('id', restaurantId);
    loadData();
});

window.editPhone = () => openTextModal("Telefone", currentData.phone, async (val) => {
    await supabase.from('restaurants').update({ phone: val }).eq('id', restaurantId);
    loadData();
});

window.editAddress = () => openTextModal("Morada", currentData.address, async (val) => {
    await supabase.from('restaurants').update({ address: val }).eq('id', restaurantId);
    loadData();
});


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

window.addNewCategory = () => {
    openTextModal("Nova Categoria", "", (val) => {
        if (!val) return;
        openAddItemModal(val);
        alert(`A criar categoria "${val}". Adiciona o primeiro prato para a guardar!`);
    });
}

window.renameCategory = (oldName) => {
    openTextModal("Renomear Categoria", oldName, async (val) => {
        if (!val || val === oldName) return;

        // 1. Update Items
        const { error } = await supabase.from('menu_items')
            .update({ category: val })
            .eq('category', oldName)
            .eq('restaurant_id', restaurantId);

        if (error) { alert("Erro ao renomear: " + error.message); return; }

        // 2. Update Image Key if exists
        if (currentData.category_images && currentData.category_images[oldName]) {
            const newImages = { ...currentData.category_images };
            newImages[val] = newImages[oldName];
            delete newImages[oldName];
            await supabase.from('restaurants').update({ category_images: newImages }).eq('id', restaurantId);
        }

        loadData();
    });
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

window.toggleAvailability = async (id, currentObj) => {
    await supabase.from('menu_items').update({ available: !currentObj }).eq('id', id);
    loadData();
}

window.deleteItem = async (id) => {
    if (confirm("Tens a certeza que queres apagar este prato?")) {
        await supabase.from('menu_items').delete().eq('id', id);
        loadData();
    }
}


// --- MODALS ---

// Text Modal
let textCallback = null;
window.openTextModal = (title, currentVal, cb) => {
    document.getElementById('textModalTitle').textContent = title;
    document.getElementById('textInput').value = currentVal || '';
    document.getElementById('textModal').classList.add('open');
    textCallback = cb;

    // Choose input type based on length/context
    if (title.includes("Descrição")) {
        document.getElementById('textInput').style.display = 'none';
        document.getElementById('textAreaInput').style.display = 'block';
        document.getElementById('textAreaInput').value = currentVal || '';
    } else {
        document.getElementById('textInput').style.display = 'block';
        document.getElementById('textAreaInput').style.display = 'none';
    }
}

document.getElementById('saveTextBtn').onclick = () => {
    const val = document.getElementById('textInput').style.display === 'none'
        ? document.getElementById('textAreaInput').value
        : document.getElementById('textInput').value;
    if (textCallback) textCallback(val);
    closeModal('textModal');
};


// Settings Modal
window.openSettingsModal = () => {
    document.getElementById('modalSlug').value = currentData.slug || '';
    document.getElementById('modalFont').value = currentData.font || 'Inter';

    // PDF Logic
    const isPdf = currentData.menu_type === 'pdf';
    document.getElementById('pdfToggle').checked = isPdf;
    togglePdfDetails();

    document.getElementById('settingsModal').classList.add('open');
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

// Dark Mode logic reused
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
    const btnIcon = document.querySelector('#themeBtn i');
    if (btnIcon) {
        btnIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

// Start
init();
