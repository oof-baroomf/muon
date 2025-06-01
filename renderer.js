document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const appContainer = document.getElementById('app-container'); // Get app container
    const urlInputArea = document.getElementById('url-input-area');
    const urlInput = document.getElementById('urlInput');
    const submitUrlButton = document.getElementById('submitUrlButton');

    const initialPlusContainer = document.getElementById('initial-plus-container');
    const initialPlus = document.getElementById('initial-plus');
    const initialWButton = document.getElementById('initial-w-button');
    const actionEnterButton = document.getElementById('action-enter-button');

    let canvasState = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        isPanning: false,
        lastPanX: 0,
        lastPanY: 0,
    };

    let views = [];
    let nextViewId = 0;
    let activeDragView = null;
    let dragStartOffset = { x: 0, y: 0 };
    let highestZIndex = 0;

    function showUrlInputUI() {
        initialPlusContainer.style.display = 'none';
        initialWButton.style.display = 'none';
        urlInputArea.style.display = 'flex';
        actionEnterButton.style.display = 'block';
        urlInput.focus();
    }

    function showInitialScreenUI() {
        initialPlusContainer.style.display = 'flex';
        initialWButton.style.display = 'block';
        urlInputArea.style.display = 'none';
        actionEnterButton.style.display = 'none';
    }

    initialPlus.addEventListener('click', showUrlInputUI);
    initialWButton.addEventListener('click', showUrlInputUI);
    actionEnterButton.addEventListener('click', () => {
        if (urlInput.value.trim() !== '') handleSubmitUrl();
        else urlInput.focus();
    });
    submitUrlButton.addEventListener('click', () => {
        if (urlInput.value.trim() !== '') handleSubmitUrl();
    });
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && urlInput.value.trim() !== '') handleSubmitUrl();
    });

    function updateCanvasTransform() {
        if (canvasState.isPanning || wheelTimeout) {
            canvas.style.transition = 'none';
        } else {
            canvas.style.transition = 'transform 0.1s ease-out';
        }
        canvas.style.transform = `translate(${canvasState.offsetX}px, ${canvasState.offsetY}px) scale(${canvasState.scale})`;
        updateAllViewBoundsInMain();
    }

    function updateAllViewBoundsInMain() {
        views.forEach(view => {
            const currentVisualX = (view.x * canvasState.scale) + canvasState.offsetX;
            const currentVisualY = (view.y * canvasState.scale) + canvasState.offsetY;
            const currentVisualWidth = view.width * canvasState.scale;
            const currentVisualHeight = view.height * canvasState.scale;

            window.electronAPI.updateViewVisuals({
                id: view.id,
                visualX: currentVisualX,
                visualY: currentVisualY,
                visualWidth: currentVisualWidth,
                visualHeight: currentVisualHeight,
                newScale: canvasState.scale
            });
        });
    }

    async function handleSubmitUrl() {
        let url = urlInput.value.trim();
        if (!url) return;

        if (!url.match(/^([a-zA-Z]+:\/\/)/) && url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
        } else if (!url.match(/^([a-zA-Z]+:\/\/)/)) {
            url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const centerXOnCanvas = (viewportWidth / 2 - canvasState.offsetX) / canvasState.scale;
        const centerYOnCanvas = (viewportHeight / 2 - canvasState.offsetY) / canvasState.scale;

        const defaultWidth = 800;
        const defaultHeight = 600;

        const viewData = {
            id: `view-${nextViewId++}`,
            url: url,
            x: centerXOnCanvas - defaultWidth / 2,
            y: centerYOnCanvas - defaultHeight / 2,
            width: defaultWidth,
            height: defaultHeight,
            zIndex: ++highestZIndex,
        };

        const placeholder = document.createElement('div');
        placeholder.className = 'view-placeholder';
        placeholder.dataset.viewId = viewData.id;
        placeholder.style.left = `${viewData.x}px`;
        placeholder.style.top = `${viewData.y}px`;
        placeholder.style.width = `${viewData.width}px`;
        placeholder.style.height = `${viewData.height}px`;
        placeholder.style.zIndex = viewData.zIndex.toString();

        const titleBar = document.createElement('div');
        titleBar.className = 'view-title-bar';
        
        const titleText = document.createElement('span');
        titleText.className = 'view-title';
        titleText.textContent = url.length > 50 ? url.substring(0, 47) + "..." : url;

        const closeButton = document.createElement('button');
        closeButton.className = 'view-close-button';
        closeButton.innerHTML = '×';
        closeButton.title = 'Close View';

        titleBar.appendChild(titleText);
        titleBar.appendChild(closeButton);
        placeholder.appendChild(titleBar);
        canvas.appendChild(placeholder);

        viewData.element = placeholder;
        viewData.titleBar = titleBar;
        viewData.titleTextElement = titleText;
        views.push(viewData);

        titleBar.addEventListener('mousedown', onDragStart);
        placeholder.addEventListener('mousedown', () => bringViewToFront(viewData.id));
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeView(viewData.id);
        });

        const initialVisualX = (viewData.x * canvasState.scale) + canvasState.offsetX;
        const initialVisualY = (viewData.y * canvasState.scale) + canvasState.offsetY;
        const initialVisualWidth = viewData.width * canvasState.scale;
        const initialVisualHeight = viewData.height * canvasState.scale;

        await window.electronAPI.createView({
            id: viewData.id,
            url: viewData.url,
            x: initialVisualX,
            y: initialVisualY,
            width: initialVisualWidth,
            height: initialVisualHeight,
            logicalWidth: viewData.logicalWidth,
            logicalHeight: viewData.logicalHeight,
            initialScale: canvasState.scale
        });

        urlInput.value = '';
    }
    
    function bringViewToFront(viewId) {
        const view = views.find(v => v.id === viewId);
        if (view && view.zIndex <= highestZIndex) {
            view.zIndex = ++highestZIndex;
            view.element.style.zIndex = view.zIndex.toString();
            window.electronAPI.focusView(view.id);
        }
    }

    function removeView(viewId) {
        const viewIndex = views.findIndex(v => v.id === viewId);
        if (viewIndex > -1) {
            const view = views[viewIndex];
            if (view.element) view.element.remove();
            views.splice(viewIndex, 1);
            window.electronAPI.removeView(viewId);
        }
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.target === canvas) {
            canvasState.isPanning = true;
            canvasState.lastPanX = e.clientX;
            canvasState.lastPanY = e.clientY;
            canvas.classList.add('grabbing');
            e.preventDefault();
        }
    });

    function onDragStart(e) {
        e.stopPropagation();
        const placeholderElement = e.currentTarget.closest('.view-placeholder');
        const viewId = placeholderElement.dataset.viewId;
        activeDragView = views.find(v => v.id === viewId);

        if (!activeDragView) return;

        bringViewToFront(activeDragView.id);
        placeholderElement.classList.add('active-drag');

        const mouseOnCanvasX = (e.clientX - canvasState.offsetX) / canvasState.scale;
        const mouseOnCanvasY = (e.clientY - canvasState.offsetY) / canvasState.scale;
        dragStartOffset.x = mouseOnCanvasX - activeDragView.x;
        dragStartOffset.y = mouseOnCanvasY - activeDragView.y;

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        canvas.classList.add('grabbing');
    }

    function onDragMove(e) {
        if (!activeDragView) return;
        e.preventDefault();

        const mouseOnCanvasX = (e.clientX - canvasState.offsetX) / canvasState.scale;
        const mouseOnCanvasY = (e.clientY - canvasState.offsetY) / canvasState.scale;

        activeDragView.x = mouseOnCanvasX - dragStartOffset.x;
        activeDragView.y = mouseOnCanvasY - dragStartOffset.y;

        activeDragView.element.style.left = `${activeDragView.x}px`;
        activeDragView.element.style.top = `${activeDragView.y}px`;

        updateAllViewBoundsInMain();
    }

    function onDragEnd(e) {
        if (activeDragView && activeDragView.element) {
            activeDragView.element.classList.remove('active-drag');
        }
        activeDragView = null;
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        canvas.classList.remove('grabbing');
    }

    window.addEventListener('mousemove', (e) => {
        if (canvasState.isPanning && !activeDragView) {
            const dx = e.clientX - canvasState.lastPanX;
            const dy = e.clientY - canvasState.lastPanY;
            canvasState.offsetX += dx;
            canvasState.offsetY += dy;
            canvasState.lastPanX = e.clientX;
            canvasState.lastPanY = e.clientY;
            updateCanvasTransform();
        }
    });

    window.addEventListener('mouseup', () => {
        if (canvasState.isPanning) {
            canvasState.isPanning = false;
            canvas.classList.remove('grabbing');
            updateCanvasTransform();
        }
    });

    let wheelTimeout = null;
    appContainer.addEventListener('wheel', (e) => {
        // Prevent zoom if focus is on input elements or similar
        if (urlInput.contains(e.target) || submitUrlButton.contains(e.target) || (e.target && e.target.closest && e.target.closest('.view-title-bar'))) {
            return; // Don't zoom if interacting with controls or title bars
        }
        e.preventDefault();
        const zoomIntensity = 0.07;
        const scrollDelta = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);

        const mouseX = e.clientX;
        const mouseY = e.clientY;

        const mouseBeforeZoomX = (mouseX - canvasState.offsetX) / canvasState.scale;
        const mouseBeforeZoomY = (mouseY - canvasState.offsetY) / canvasState.scale;

        const oldScale = canvasState.scale;
        canvasState.scale *= scrollDelta;
        canvasState.scale = Math.max(0.05, Math.min(canvasState.scale, 20));

        canvasState.offsetX = mouseX - (mouseBeforeZoomX * canvasState.scale);
        canvasState.offsetY = mouseY - (mouseBeforeZoomY * canvasState.scale);
        
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
            wheelTimeout = null;
            updateCanvasTransform();
        }, 150);

        updateCanvasTransform();
    }, { passive: false });

    showInitialScreenUI();
    updateCanvasTransform();
});
