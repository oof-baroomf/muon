const urlInputContainer = document.getElementById('url-input-container');
const urlInput = document.getElementById('url-input');
const viewsContainer = document.getElementById('views-container');
const bottomIndicator = document.getElementById('bottom-indicator');
const promptCharElement = urlInputContainer.querySelector('.prompt-char');

let activeViewElement = null;
const viewElements = new Map();

function showUrlInput(promptChar = 'W') {
    promptCharElement.textContent = promptChar;
    urlInputContainer.classList.remove('hidden');
    urlInput.value = '';
    urlInput.focus();
    bottomIndicator.innerHTML = '⏎';
    bottomIndicator.classList.remove('hidden');
}

function hideUrlInput() {
    urlInputContainer.classList.add('hidden');
    urlInput.blur();
    bottomIndicator.classList.add('hidden');
}

urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        let url = urlInput.value.trim();
        if (url) {
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                if (url.includes('.') && !url.includes(' ')) {
                    url = `https://${url}`;
                } else {
                    url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
                }
            }
            window.electronAPI.createNewView(url);
            hideUrlInput();
        }
    } else if (e.key === 'Escape') {
        hideUrlInput();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    if (e.key.toUpperCase() === 'W' && urlInputContainer.classList.contains('hidden')) {
        e.preventDefault();
        showUrlInput('W');
    }
});

window.electronAPI.onViewCreated(({ id, x, y, width, height, url }) => {
    const viewEl = document.createElement('div');
    viewEl.classList.add('view-window');
    viewEl.dataset.viewId = id;
    viewEl.style.transform = 'scale(0.8)';
    viewEl.style.opacity = '0';
    viewEl.style.left = `${x}px`;
    viewEl.style.top = `${y}px`;
    viewEl.style.width = `${width}px`;
    viewEl.style.height = `${height}px`;

    const header = document.createElement('div');
    header.classList.add('view-header');
    header.textContent = new URL(url).hostname;

    const controls = document.createElement('div');
    controls.classList.add('view-controls');
    const closeButton = document.createElement('button');
    closeButton.classList.add('view-close-button');
    closeButton.innerHTML = '×';
    closeButton.onclick = (e) => {
        e.stopPropagation();
        window.electronAPI.closeView(id);
    };
    controls.appendChild(closeButton);
    header.appendChild(controls);
    viewEl.appendChild(header);

    const contentArea = document.createElement('div');
    contentArea.classList.add('view-content-area');
    contentArea.textContent = `Loading ${url}...`;
    viewEl.appendChild(contentArea);

    viewsContainer.appendChild(viewEl);
    viewElements.set(id, viewEl);

    requestAnimationFrame(() => {
        viewEl.style.transform = 'scale(1)';
        viewEl.style.opacity = '1';
    });

    setActiveView(viewEl);
    makeDraggableAndResizable(viewEl, id);
});

window.electronAPI.onViewClosedAck((viewId) => {
    const viewEl = viewElements.get(viewId);
    if (viewEl) {
        viewEl.style.transform = 'scale(0.8)';
        viewEl.style.opacity = '0';
        setTimeout(() => {
            viewEl.remove();
            viewElements.delete(viewId);
            if (activeViewElement === viewEl) {
                activeViewElement = null;
                const remainingViews = Array.from(viewElements.values());
                if (remainingViews.length > 0) {
                    setActiveView(remainingViews[remainingViews.length - 1]);
                }
            }
        }, 300);
    }
});

function setActiveView(viewEl) {
    if (activeViewElement) {
        activeViewElement.classList.remove('active');
    }
    activeViewElement = viewEl;
    if (activeViewElement) {
        activeViewElement.classList.add('active');
        viewsContainer.appendChild(activeViewElement);
        window.electronAPI.focusView(activeViewElement.dataset.viewId);
    }
}

viewsContainer.addEventListener('mousedown', (e) => {
    const targetView = e.target.closest('.view-window');
    if (targetView) {
        setActiveView(targetView);
    }
}, true);

function makeDraggableAndResizable(element, viewId) {
    let isDragging = false;
    let isResizing = false;
    let currentX, currentY, initialX, initialY, initialMouseX, initialMouseY;
    let initialWidth, initialHeight;

    const header = element.querySelector('.view-header');

    if (header) {
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('view-close-button')) return;
            e.preventDefault();
            isDragging = true;
            initialX = element.offsetLeft;
            initialY = element.offsetTop;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            element.classList.add('dragging');
        });
    }

    const resizeHandle = document.createElement('div');
    resizeHandle.classList.add('resize-handle');
    element.appendChild(resizeHandle);

    resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        initialWidth = element.offsetWidth;
        initialHeight = element.offsetHeight;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        element.classList.add('resizing');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging && !isResizing) return;
        e.preventDefault();

        if (isDragging) {
            currentX = initialX + (e.clientX - initialMouseX);
            currentY = initialY + (e.clientY - initialMouseY);
            element.style.left = `${currentX}px`;
            element.style.top = `${currentY}px`;
        } else if (isResizing) {
            const newWidth = initialWidth + (e.clientX - initialMouseX);
            const newHeight = initialHeight + (e.clientY - initialMouseY);
            element.style.width = `${Math.max(200, newWidth)}px`;
            element.style.height = `${Math.max(150, newHeight)}px`;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging || isResizing) {
            window.electronAPI.updateViewBounds(viewId, {
                x: element.offsetLeft,
                y: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight
            });

            if (isDragging) {
                isDragging = false;
                element.classList.remove('dragging');
            }
            if (isResizing) {
                isResizing = false;
                element.classList.remove('resizing');
            }
        }
    });

    element.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();

            let currentScale = parseFloat(element.style.getPropertyValue('--view-scale') || 1);
            const scaleAmount = 0.1;

            if (e.deltaY < 0) {
                currentScale += scaleAmount;
            } else {
                currentScale -= scaleAmount;
            }
            currentScale = Math.max(0.25, Math.min(currentScale, 5));

            const rect = element.getBoundingClientRect();
            const originX = ((e.clientX - rect.left) / rect.width) * 100;
            const originY = ((e.clientY - rect.top) / rect.height) * 100;

            element.style.transformOrigin = `${originX}% ${originY}%`;
            element.style.setProperty('--view-scale', currentScale);
            element.style.transform = `scale(${currentScale})`;
            window.electronAPI.zoomView(viewId, currentScale);
        }
    }, { passive: false });
}

window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('view-created');
    window.electronAPI.removeAllListeners('view-closed-ack');
});

hideUrlInput();
