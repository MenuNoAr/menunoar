/**
 * render.js - UI Generation and Rendering
 */
import { state, updateState } from './state.js';
import { saveCategoryOrder, loadData } from './api.js';
import { uploadFile } from '../upload-service.js';

export function updateLiveLink(slug) {
    const url = `${window.location.origin}/menu.html?id=${slug}`;
    const btn = document.getElementById('liveLinkBtn');
    if (btn) btn.onclick = () => window.open(url, '_blank');
    const link = document.getElementById('liveLink');
    if (link) link.href = url;
}

export function renderHeader(data) {
    document.getElementById('restNameEditor').textContent = data.name || "Nome do Restaurante";
    document.getElementById('restDescEditor').textContent = data.description || "Descrição curta (clica para editar)";

    const coverDiv = document.getElementById('coverEditor');
    let overlayContent = '';

    if (data.cover_url) {
        coverDiv.style.backgroundImage = `url('${data.cover_url}')`;
        coverDiv.style.height = '350px';
        overlayContent = `
            <div class="edit-overlay"><i class="fa-solid fa-camera"></i> Alterar Capa</div>
            <div style="position: absolute; top: 15px; right: 15px; z-index: 50;">
                <button class="action-btn btn-delete" onclick="deleteCover(); event.stopPropagation();" title="Remover Capa" style="width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    } else {
        coverDiv.style.backgroundImage = 'none';
        coverDiv.style.backgroundColor = 'var(--bg-page)';
        coverDiv.style.height = '120px';
        overlayContent = `<div class="edit-overlay"><i class="fa-solid fa-camera"></i> Adicionar Capa</div>`;
    }

    coverDiv.innerHTML = overlayContent + `<input type="file" id="coverUpload" style="display:none;" accept="image/*" onchange="handleCoverUpload(this)">`;

    updateBadge('badgeWifi', 'textWifi', data.wifi_password);
    updateBadge('badgePhone', 'textPhone', data.phone);
    updateBadge('badgeAddress', 'textAddress', data.address);
}

function updateBadge(badgeId, textId, value) {
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

export function renderMenu(items) {
    const container = document.getElementById('menuContainer');
    const nav = document.getElementById('categoryNav');

    container.innerHTML = '<div id="editorTrack" class="slider-track" style="transition: transform 0.3s ease;"></div>';
    const track = document.getElementById('editorTrack');
    nav.className = 'category-tabs sticky-nav';
    nav.innerHTML = '';

    let uniqueCatsSet = new Set(items.map(i => i.category));
    if (state.currentData.category_order) state.currentData.category_order.forEach(c => uniqueCatsSet.add(c));

    let uniqueCats = Array.from(uniqueCatsSet);

    if (state.currentData.category_order) {
        const savedOrder = state.currentData.category_order;
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
        groups[c] = items.filter(i => i.category === c);
    });

    uniqueCats.forEach((cat, index) => {
        const btn = document.createElement('div');
        btn.className = 'tab-btn draggable-tab';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.gap = '2px';

        if (state.activeCategoryName) {
            if (cat === state.activeCategoryName) btn.classList.add('active');
        } else if (index === 0) {
            btn.classList.add('active');
            updateState({ activeCategoryName: cat });
        }

        btn.onclick = () => scrollToSlide(index);
        btn.innerHTML = `
            <span>${cat}</span>
            <div class="handle" style="padding: 15px 15px; margin: -10px -10px -10px -5px; cursor:grab; display:flex; align-items:center;">
                <i class="fa-solid fa-grip-lines-vertical" style="opacity:0.3; font-size: 0.9rem;"></i>
            </div>
        `;
        btn.dataset.category = cat;
        btn.dataset.index = index;
        nav.appendChild(btn);

        const section = document.createElement('div');
        section.id = `sec-${cat}`;
        section.className = 'menu-slide';
        section.style.minWidth = '100%';

        const catImages = state.currentData.category_images || {};
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

        let itemsHTML = groups[cat].map(item => createItemCard(item)).join('');
        const addItemBtn = `
            <div class="add-item-btn" onclick="openAddItemModal('${cat}')">
                <span><i class="fa-solid fa-plus"></i> Adicionar Prato em "${cat}"</span>
            </div>
        `;

        section.innerHTML = headerHTML + `<div class="items-grid">${itemsHTML}</div>` + addItemBtn;
        track.appendChild(section);
    });

    const addCatBtn = document.createElement('button');
    addCatBtn.innerHTML = '<i class="fa-solid fa-plus"></i> <span style="margin-left: 5px;">Nova Categoria</span>';
    addCatBtn.className = 'tab-btn btn-add-cat';
    addCatBtn.onclick = () => window.addNewCategoryOptimized();
    nav.appendChild(addCatBtn);

    const spacer = document.createElement('div');
    spacer.style.minWidth = '40px';
    nav.appendChild(spacer);

    if (state.activeCategoryName) {
        const newIdx = uniqueCats.indexOf(state.activeCategoryName);
        if (newIdx !== -1) updateState({ currentSlideIndex: newIdx });
    }

    setTimeout(() => scrollToSlide(state.currentSlideIndex, { instant: true }), 50);

    if (window.Sortable) {
        if (state.sortableInstance) state.sortableInstance.destroy();
        updateState({
            sortableInstance: new Sortable(nav, {
                animation: 150,
                handle: '.handle',
                draggable: '.draggable-tab',
                ghostClass: 'sortable-ghost',
                onEnd: async function () {
                    const newOrder = [];
                    nav.querySelectorAll('.draggable-tab').forEach(tab => newOrder.push(tab.dataset.category));
                    await saveCategoryOrder(newOrder);
                    const newIndex = Array.from(nav.querySelectorAll('.tab-btn')).findIndex(btn => btn.classList.contains('active'));
                    if (newIndex !== -1) updateState({ currentSlideIndex: newIndex });
                }
            })
        });
    }
}

export function scrollToSlide(index, options = {}) {
    const track = document.getElementById('editorTrack');
    if (!track || !track.children.length) return;

    if (index >= track.children.length) index = track.children.length - 1;
    if (index < 0) index = 0;

    updateState({ currentSlideIndex: index });

    if (options.instant) {
        track.style.transition = 'none';
        track.style.transform = `translateX(-${index * 100}%)`;
        track.offsetHeight;
        setTimeout(() => { track.style.transition = 'transform 0.3s ease'; }, 50);
    } else {
        track.style.transition = 'transform 0.3s ease';
        track.style.transform = `translateX(-${index * 100}%)`;
    }

    const tabs = document.querySelectorAll('.draggable-tab');
    tabs.forEach((t, i) => {
        if (i === index) {
            t.classList.add('active');
            updateState({ activeCategoryName: t.dataset.category });
        } else {
            t.classList.remove('active');
        }
    });

    const container = document.getElementById('menuContainer');
    const currentSlide = track.children[index];

    if (currentSlide) {
        container.style.height = currentSlide.offsetHeight + 'px';
        if (state.slideObserver) state.slideObserver.disconnect();
        const obs = new ResizeObserver(entries => {
            for (let entry of entries) {
                container.style.height = entry.target.offsetHeight + 'px';
            }
        });
        obs.observe(currentSlide);
        updateState({ slideObserver: obs });
    }
}

export function createItemCard(item) {
    const isAvail = item.available;
    const eyeIcon = isAvail ? 'fa-eye' : 'fa-eye-slash';
    const eyeColor = isAvail ? 'var(--success)' : '#ccc';

    return `
        <div id="item-card-${item.id}" class="menu-item ${!isAvail ? 'unavailable' : ''} editable-container" style="position:relative; align-items:center;">
            <div class="item-text" style="flex:1;">
                <h3 contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${item.id}', 'name', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" style="margin-bottom:5px; display:inline-block;">${item.name}</h3>
                <p contenteditable="true" spellcheck="false" class="item-desc inline-editable" onblur="handleItemUpdate('${item.id}', 'description', this.innerText)" style="font-size:0.85rem; color:#666; margin-bottom:8px;">${item.description || ''}</p>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="item-price" style="font-weight:700; display:flex; align-items:center;">
                        <span contenteditable="true" spellcheck="false" class="inline-editable" onblur="handleItemUpdate('${item.id}', 'price', this.innerText)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${Number(item.price).toFixed(2)}</span>€
                    </div>
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
                ${item.image_url ? `<img src="${item.image_url}">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eee; color:#bbb; font-size:1.5rem;"><i class="fa-solid fa-image"></i></div>`}
            </div>
        </div>
    `;
}
