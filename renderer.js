const DEFAULT_LOGICAL_WIDTH = 1280;
const DEFAULT_LOGICAL_HEIGHT = 720;

const canvasWrapper = document.getElementById('canvas-wrapper');
const canvas = document.getElementById('canvas');
const urlInput = document.getElementById('url-input');

let currentScale = 1.0, panX = 0, panY = 0;
let isPanning = false, lastMouseX, lastMouseY;
const viewPlaceholders = new Map();
let nextViewId = 0;

function updateCanvasAndViews() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
    viewPlaceholders.forEach(updateViewVisuals);
}

function getScreenRectForView(viewData) {
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: canvasRect.left + (viewData.logicalX * currentScale),
        y: canvasRect.top + (viewData.logicalY * currentScale),
        width: viewData.logicalWidth * currentScale,
        height: viewData.logicalHeight * currentScale,
    };
}

function updateViewVisuals(viewData, id) {
    const placeholder = viewData.element;
    placeholder.style.left = `${viewData.logicalX}px`;
    placeholder.style.top = `${viewData.logicalY}px`;
    placeholder.style.width = `${viewData.logicalWidth}px`;
    placeholder.style.height = `${viewData.logicalHeight}px`;

    const screenRect = getScreenRectForView(viewData);
    window.electronAPI.updateViewVisuals({ id, ...screenRect, canvasScale: currentScale });
}

urlInput.addEventListener('keypress', (e) => {
    if (e.key !== 'Enter' || !urlInput.value.trim()) return;
    let url = urlInput.value.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    const id = `view-${nextViewId++}`;
    const viewportCenterX = (canvasWrapper.offsetWidth / 2 - panX) / currentScale;
    const viewportCenterY = (canvasWrapper.offsetHeight / 2 - panY) / currentScale;
    const logicalX = viewportCenterX - (DEFAULT_LOGICAL_WIDTH / 2) + (Math.random() - 0.5) * 50;
    const logicalY = viewportCenterY - (DEFAULT_LOGICAL_HEIGHT / 2) + (Math.random() - 0.5) * 50;

    const placeholder = document.createElement('div');
    placeholder.className = 'view-placeholder';
    placeholder.id = `placeholder-${id}`;

    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.innerHTML = '×';
    closeButton.onclick = (ev) => { ev.stopPropagation(); removeView(id); };
    placeholder.appendChild(closeButton);
    canvas.appendChild(placeholder);

    const viewData = {
        element: placeholder,
        logicalX, logicalY,
        logicalWidth: DEFAULT_LOGICAL_WIDTH,
        logicalHeight: DEFAULT_LOGICAL_HEIGHT
    };
    viewPlaceholders.set(id, viewData);

    const screenRect = getScreenRectForView(viewData);
    window.electronAPI.createView({ id, url, ...screenRect, canvasScale: currentScale });
    updateViewVisuals(viewData, id);
    urlInput.value = '';
});

function removeView(id) {
    const viewData = viewPlaceholders.get(id);
    if (viewData) {
        viewData.element.remove();
        viewPlaceholders.delete(id);
        window.electronAPI.removeView(id);
    }
}

canvas.addEventListener('mousedown', (e) => {
    if (e.target !== canvas) return;
    isPanning = true;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX += e.clientX - lastMouseX; panY += e.clientY - lastMouseY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    updateCanvasAndViews();
});

window.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; canvas.style.cursor = 'grab'; }
});

canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    const oldScale = currentScale;
    currentScale = Math.max(0.1, Math.min(3.0, currentScale * (1 - e.deltaY * zoomIntensity * 0.1)));

    const rect = canvasWrapper.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    panX = mouseX - (mouseX - panX) * (currentScale / oldScale);
    panY = mouseY - (mouseY - panY) * (currentScale / oldScale);
    updateCanvasAndViews();
}, { passive: false });

updateCanvasAndViews();
