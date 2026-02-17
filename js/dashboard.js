/* dashboard.js - Unified Visual Editor Logic */
import { initUploadService, uploadFile } from './upload-service.js';

let supabase;
let currentUser;
let restaurantId;
let currentData = {}; // Store restaurant data
let menuItems = [];   // Store items

// Function to initialize everything
async function init() {
    const res = await fetch('/api/config');
    const config = await res.json();
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    // Init upload service with our supabase instance
    initUploadService(supabase);

    const storedUser = localStorage.getItem('menu_user');
    if (!storedUser) { window.location.href = 'login.html'; return; }
    currentUser = JSON.parse(storedUser);

    document.getElementById('userDisplay').textContent = currentUser.username;
    loadData();
}

window.signOut = () => { localStorage.removeItem('menu_user'); window.location.href = 'index.html'; }

// --- DATA LOADING ---
async function loadData() {
    // Fetch Restaurant
    const { data: rest } = await supabase.from('restaurants').select('*').eq('owner_username', currentUser.username).single();

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

        if (!hasPratosPrincipais) {
            console.log("Seeding Pratos Principais...");
            const demoItems = [
                { restaurant_id: restaurantId, name: 'Bacalhau à Lagareiro', description: 'Lombo alto, batatas a murro e muito azeite.', price: 18.50, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Arroz de Marisco', description: 'Arroz malandrinho recheado de mar.', price: 22.00, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Polvo à Lagareiro', description: 'Tenro, assado e bem regado.', price: 19.50, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Caldeirada de Peixe', description: 'Peixe fresco cozinhado lentamente.', price: 16.00, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Bacalhau com Natas', description: 'Cremoso, gratinado e impossível de ignorar.', price: 14.50, category: 'Pratos Principais', available: true },
                { restaurant_id: restaurantId, name: 'Feijoada de Marisco', description: 'Feijão e marisco numa combinação ousada.', price: 18.00, category: 'Pratos Principais', available: true }
            ];

            const { error: insertError } = await supabase.from('menu_items').insert(demoItems);

            if (!insertError) {
                // Recarregar para ter os IDs reais
                return loadData();
            } else {
                console.error("Erro ao criar pratos demo:", insertError);
            }
        }

        // --- SEEDING LOGIC: Sobremesas ---
        const hasSobremesas = menuItems.some(i => i.category === 'Sobremesas');

        if (!hasSobremesas) {
            console.log("Seeding Sobremesas...");
            const dessertItems = [
                { restaurant_id: restaurantId, name: 'Pastel de Nata', description: 'Pequeno, mas manda no prato.', price: 1.50, category: 'Sobremesas', available: true },
                { restaurant_id: restaurantId, name: 'Leite Creme', description: 'Creme sedoso com crosta caramelizada.', price: 3.50, category: 'Sobremesas', available: true },
                { restaurant_id: restaurantId, name: 'Arroz Doce', description: 'Clássico caseiro com desenhos canela.', price: 3.00, category: 'Sobremesas', available: true },
                { restaurant_id: restaurantId, name: 'Baba de Camelo', description: 'Doce, leve e misteriosa na origem.', price: 3.50, category: 'Sobremesas', available: true },
                { restaurant_id: restaurantId, name: 'Toucinho do Céu', description: 'Pecado doce oficialmente aprovado.', price: 4.50, category: 'Sobremesas', available: true },
                { restaurant_id: restaurantId, name: 'Mousse de Chocolate', description: 'Intensa e cremosa.', price: 3.50, category: 'Sobremesas', available: true }
            ];

            const { error: insertDessertError } = await supabase.from('menu_items').insert(dessertItems);

            if (!insertDessertError) {
                return loadData();
            } else {
                console.error("Erro ao criar sobremesas demo:", insertDessertError);
            }
        }

        renderMenu(menuItems);
    } else {
        document.getElementById('restNameEditor').textContent = "Clica para nomear";
    }
}

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
    container.innerHTML = '';
    nav.innerHTML = ''; // We will rebuild nav

    // Group items
    const uniqueCats = [...new Set(items.map(i => i.category))];
    const groups = {};
    uniqueCats.forEach(c => groups[c] = items.filter(i => i.category === c));

    // Render Categories
    uniqueCats.forEach(cat => {
        // Nav Button (Tab Style)
        const btn = document.createElement('button');
        btn.textContent = cat;
        btn.className = 'tab-btn'; // Match menu.css
        btn.onclick = () => document.getElementById(`sec-${cat}`).scrollIntoView({ behavior: 'smooth' });
        nav.appendChild(btn);

        // Section (Slide Style but Vertical)
        const section = document.createElement('div');
        section.id = `sec-${cat}`;
        section.className = 'menu-slide'; // Match menu.css
        section.style.borderBottom = '1px solid #f0f0f0'; // Visual separator for editor

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
            // Match menu.html slide-title but make it editable/uploadable
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
        container.appendChild(section);
    });

    // "Add Category" button in Nav
    const addCatBtn = document.createElement('button');
    addCatBtn.innerHTML = '<i class="fa-solid fa-folder-plus"></i> Categoria';
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = addNewCategory;
    nav.appendChild(addCatBtn);
}

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
}

// Start
init();
