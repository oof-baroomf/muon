const canvasContainer = document.getElementById('canvas-container');
const canvas = document.getElementById('canvas');
const urlInputContainer = document.getElementById('url-input-container');
const urlInput = document.getElementById('url-input');
const backButton = document.getElementById('back-button');

let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastMouseX, lastMouseY;

let nextViewIdNum = 0;
const views = new Map();
let activeViewId = null;
let newViewPendingPos = { x: 0, y: 0 };

function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    updateAllViewBounds();
}

function updateAllViewBounds() {
    const containerRect = canvasContainer.getBoundingClientRect();
    views.forEach(viewData => {
        const screenX = viewData.logicalX * scale + panX;
        const screenY = viewData.logicalY * scale + panY;

        window.electronAPI.updateViewBounds(viewData.id, {
            x: Math.round(screenX + containerRect.left),
            y: Math.round(screenY + containerRect.top),
            width: Math.round(viewData.width * scale),
            height: Math.round(viewData.height * scale)
        });
    });
}

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target === canvasContainer || e.target === canvas) {
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvasContainer.style.cursor = 'grabbing';
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        panX += dx;
        panY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        applyTransform();
    } else {
        const draggingView = Array.from(views.values()).find(v => v.isDragging);
        if (draggingView) {
            const dx = (e.clientX - lastMouseX) / scale;
            const dy = (e.clientY - lastMouseY) / scale;
            draggingView.logicalX += dx;
            draggingView.logicalY += dy;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            updateViewProxyElementPosition(draggingView);
            updateAllViewBounds();
        }
    }
});

window.addEventListener('mouseup', () => {
    if (isPanning) {
        isPanning = false;
        canvasContainer.style.cursor = 'crosshair';
    }
    const draggingView = Array.from(views.values()).find(v => v.isDragging);
    if (draggingView) {
        draggingView.isDragging = false;
        draggingView.element.style.cursor = 'grab';
    }
});

canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.1;
    const oldScale = scale;

    if (e.deltaY < 0) {
        scale *= zoomFactor;
    } else {
        scale /= zoomFactor;
    }
    scale = Math.max(0.05, Math.min(scale, 20));

    panX = mouseX - (mouseX - panX) * (scale / oldScale);
    panY = mouseY - (mouseY - panY) * (scale / oldScale);

    applyTransform();
});

function createViewProxyElement(viewData) {
    const proxy = document.createElement('div');
    proxy.classList.add('view-proxy');
    proxy.dataset.id = viewData.id;
    proxy.style.left = `${viewData.logicalX}px`;
    proxy.style.top = `${viewData.logicalY}px`;
    proxy.style.width = `${viewData.width}px`;
    proxy.style.height = `${viewData.height}px`;
    proxy.style.zIndex = views.size;

    proxy.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        setActiveView(viewData.id);
        viewData.isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        proxy.style.cursor = 'grabbing';

        Array.from(views.values()).forEach(v => {
            v.element.style.zIndex = v.id === viewData.id ? views.size + 1 : parseInt(v.element.style.zIndex) || 0;
        });
        viewData.element.style.zIndex = views.size + 1;
    });

    proxy.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveView(viewData.id);
    });

    canvas.appendChild(proxy);
    return proxy;
}

function updateViewProxyElementPosition(viewData) {
    viewData.element.style.left = `${viewData.logicalX}px`;
    viewData.element.style.top = `${viewData.logicalY}px`;
    viewData.element.style.width = `${viewData.width}px`;
    viewData.element.style.height = `${viewData.height}px`;
}

function setActiveView(id) {
    if (activeViewId === id && id !== null) return;

    if (activeViewId !== null && views.has(activeViewId)) {
        views.get(activeViewId).element.classList.remove('active');
    }

    activeViewId = id;

    if (id !== null && views.has(id)) {
        const viewData = views.get(id);
        viewData.element.classList.add('active');
        window.electronAPI.focusView(id);
        backButton.style.display = 'block';
        viewData.element.style.zIndex = views.size + 1;
    } else {
        backButton.style.display = 'none';
    }
}

window.addEventListener('keydown', (e) => {
    if (document.activeElement === urlInput) return;

    if (e.key.toLowerCase() === 'w' && urlInputContainer.style.display === 'none') {
        e.preventDefault();
        const containerRect = canvasContainer.getBoundingClientRect();
        const viewportCenterX = (containerRect.width / 2 - panX) / scale;
        const viewportCenterY = (containerRect.height / 2 - panY) / scale;

        const defaultWidth = 800;
        const defaultHeight = 600;
        newViewPendingPos = { x: viewportCenterX - defaultWidth / 2, y: viewportCenterY - defaultHeight / 2 };

        urlInputContainer.style.display = 'flex';
        urlInput.value = '';
        urlInput.focus();
    } else if (e.key === 'Escape' && urlInputContainer.style.display !== 'none') {
        urlInputContainer.style.display = 'none';
        urlInput.blur();
    }
});

urlInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (!url) return;
        if (!url.includes('://')) {
            url = 'https://' + url;
        }

        urlInputContainer.style.display = 'none';
        urlInput.blur();

        const id = `view-${nextViewIdNum++}`;
        const defaultWidth = 800;
        const defaultHeight = 600;

        const viewData = {
            id,
            logicalX: newViewPendingPos.x,
            logicalY: newViewPendingPos.y,
            width: defaultWidth,
            height: defaultHeight,
            url: url,
            isDragging: false,
        };

        console.log(`[Renderer] Requesting creation of view ${id} for URL ${url}`);
        const createdId = await window.electronAPI.createView(id, url);

        if (createdId) {
            console.log(`[Renderer] Main process confirmed creation for view ${createdId}. Initializing proxy.`);
            viewData.element = createViewProxyElement(viewData);
            viewData.status = 'loading'; // Track view state in renderer too
            views.set(id, viewData);
        }
    } else if (e.key === 'Escape') {
        urlInputContainer.style.display = 'none';
        urlInput.blur();
    }
});

backButton.addEventListener('click', () => {
    if (activeViewId !== null && views.has(activeViewId)) {
        window.electronAPI.navigateView(activeViewId, 'goBack');
    }
});

applyTransform();

window.addEventListener('resize', () => {
    applyTransform();
});

// Handle when view is ready for bounds updates
window.electronAPI.onViewReadyForBounds((id) => {
    const viewData = views.get(id);
    if (viewData) {
        console.log(`[Renderer] View ${id} is ready for bounds updates.`);
        viewData.status = 'active';
        setActiveView(id);
        updateAllViewBounds();
    }
});

// Handle view crashes or removals from main process
window.electronAPI.onViewCrashedOrRemoved((id) => {
    const viewData = views.get(id);
    if (viewData) {
        console.error(`[Renderer] View ${id} (URL: ${viewData.url || 'unknown'}) crashed or was removed from main process.`);
        // Show crash UI
        if (viewData.element) {
            viewData.element.innerHTML = `
                <div class="crash-overlay">
                    <div class="crash-message">
                        <h3>Page Unavailable</h3>
                        ${viewData.url ? `<p>URL: ${viewData.url}</p>` : ''}
                        <p>The page crashed or could not be loaded.</p>
                        <button class="reload-btn">Reload</button>
                    </div>
                </div>
            `;
            
            // Add reload handler
            viewData.element.querySelector('.reload-btn').addEventListener('click', () => {
                // Before reloading, clear the crash UI
                viewData.element.innerHTML = '';
                viewData.status = 'loading';
                window.electronAPI.navigateView(id, 'reload');
            });
        }

        // Update active view if needed
        if (activeViewId === id) {
            activeViewId = null;
            backButton.style.display = 'none';
        }
        views.delete(id); // Remove from renderer's tracking
    } else {
        console.warn(`[Renderer] Received onViewCrashedOrRemoved for unknown id: ${id}`);
    }
});

// Handle view recreation requests
window.electronAPI.onRecreateView((id) => {
    const viewData = views.get(id);
    if (viewData) {
        window.electronAPI.createView(id, viewData.url)
            .then(() => {
                console.log(`Successfully recreated view ${id}`);
            })
            .catch(err => {
                console.error(`Failed to recreate view ${id}:`, err);
            });
    }
});

canvasContainer.addEventListener('click', (e) => {
    if (e.target === canvasContainer || e.target === canvas) {
        if (activeViewId !== null) {
             if (views.has(activeViewId)) views.get(activeViewId).element.classList.remove('active');
            activeViewId = null;
            backButton.style.display = 'none';
        }
    }
});
