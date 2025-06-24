import './styles.css';
interface WindowData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  viewId?: number;
  scaleAtCreation?: number;
}

const root = document.getElementById('root') as HTMLElement;
root.tabIndex = 0; // allow key focus

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let windows: WindowData[] = [];
let muonActiveWindow: HTMLElement | null = null;

const desk = document.createElement('div');
desk.id = 'muon-desktop';
desk.className = 'absolute inset-0 w-[100000px] h-[100000px] origin-top-left will-change-transform bg-[repeating-linear-gradient(0deg,_#222_0_1px,_transparent_1px_32px),repeating-linear-gradient(90deg,_#222_0_1px,_transparent_1px_32px)]';
root.appendChild(desk);

function applyTransform () {
  desk.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
  // update each webview zoomFactor via Electron so pixel density remains constant
  // No longer adjusting webview zoom; scaling is handled by CSS transform.
}

function createWindowElement (w: WindowData, focusBar = false): HTMLElement {
  const cont = document.createElement('div');
  cont.className = 'muon-window absolute border rounded overflow-hidden shadow-lg';
  cont.style.left = w.x + 'px';
  cont.style.top = w.y + 'px';
  cont.style.width = w.w + 'px';
  cont.style.height = w.h + 'px';
  cont.style.transform = '';
  cont.style.transformOrigin = 'top left';
  cont.dataset.id = w.id;
  cont.style.zIndex = '1'; // Ensure window container has base z-index

  // Address bar container for flex layout
  const barZoom = w.scaleAtCreation ? 1 / w.scaleAtCreation : 1;
  const barHeight = 24 * barZoom;
  const barContainer = document.createElement('div');
  barContainer.className = 'muon-urlbar-container';
  barContainer.style.position = 'absolute';
  barContainer.style.top = '0';
  barContainer.style.left = '0';
  barContainer.style.right = '0';
  barContainer.style.height = `${barHeight}px`;
  barContainer.style.display = 'flex';
  barContainer.style.alignItems = 'center';
  barContainer.style.zIndex = '2';
  barContainer.style.background = '#23232a';

  // URL bar input
  const urlBar = document.createElement('input');
  urlBar.type = 'text';
  urlBar.value = w.url;
  urlBar.addEventListener('focus', () => {
    setTimeout(() => urlBar.select(), 0);
  });
  urlBar.addEventListener('click', (e) => {
    if (document.activeElement !== urlBar) {
      urlBar.focus();
      e.preventDefault();
    }
  });
  urlBar.className = 'muon-urlbar px-2 py-1 text-xs outline-none cursor-move';
  urlBar.style.flex = '1 1 0%';
  urlBar.style.height = `${barHeight - 4}px`;
  urlBar.style.fontSize = `${12 * barZoom}px`;
  urlBar.style.border = 'none';
  urlBar.style.background = 'transparent';
  urlBar.style.color = '#e5e5e5';
  urlBar.style.marginRight = '2px';

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove window';
  removeBtn.className = 'muon-remove bg-transparent border-none leading-none cursor-pointer';
  removeBtn.style.fontSize = `${18 * barZoom}px`;
  removeBtn.style.width = `${barHeight - 4}px`;
  removeBtn.style.height = `${barHeight - 4}px`;
  removeBtn.style.display = 'flex';
  removeBtn.style.alignItems = 'center';
  removeBtn.style.justifyContent = 'center';
  removeBtn.style.marginRight = '2px';
  removeBtn.style.zIndex = '3';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    windows = windows.filter(win => win.id !== w.id);
    cont.remove();
    save();
  };

  barContainer.appendChild(urlBar);
  barContainer.appendChild(removeBtn);

  // Webview fills the window except for the scaled address bar
  const webview = document.createElement('webview');
  webview.className = 'w-full';
  webview.src = w.url || 'https://exa.ai/search';
  webview.partition = `persist:muon-${w.id}`;
  webview.style.position = 'absolute';
  webview.style.left = '0';
  webview.style.width = '100%';
  webview.style.border = 'none';
  webview.style.top = `${barHeight}px`;
  webview.style.height = `calc(100% - ${barHeight}px)`;
  webview.style.zIndex = '0'; // Ensure webview stays behind address bar

  urlBar.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      let val = urlBar.value.trim();
      if (!/^(https?:|file:)/i.test(val)) {
        if (/^[\w-]+\.[\w-]+/.test(val)) {
          val = 'https://' + val;
        } else {
          val = 'https://exa.ai/search?q=' + encodeURIComponent(val);
        }
      }
      w.url = val;
      webview.src = val;
    }
  });

  // Inverse-zoom the webview content to compensate for global zoom at creation
  const zoom = w.scaleAtCreation ? 1 / w.scaleAtCreation : 1;
  webview.addEventListener('dom-ready', () => {
    webview.setZoomFactor(zoom);
  });

  cont.appendChild(barContainer);
  cont.appendChild(webview);

  // Autofocus address bar if requested
  if (focusBar) {
    setTimeout(() => urlBar.focus(), 0);
  }

  // double click to zoom to this window
  cont.addEventListener('dblclick', e => {
    e.stopPropagation();
    // center on window
    const bounds = cont.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2 - root.clientWidth / 2;
    const cy = bounds.top + bounds.height / 2 - root.clientHeight / 2;
    offsetX -= cx / scale;
    offsetY -= cy / scale;
    applyTransform();
  });

  desk.appendChild(cont);
  return cont;
}

function rebuild () {
  desk.innerHTML = '';
  windows.forEach(w => {
    const cont = createWindowElement(w, false);
    addResizeHandle(cont, w);
    
    // Add drag to address bar
    const urlBar = cont.querySelector('.muon-urlbar') as HTMLInputElement;
    if (urlBar) {
      addAddressBarDrag(urlBar, cont, w);
    }
  });
  applyTransform();
}

// Tiny custom URL-input overlay to replace prompt()
/**
 * askUrl is now a no-op; window creation will focus the address bar directly.
 */
async function askUrl(def = 'https://example.com'): Promise<string | null> {
  return Promise.resolve(def);
}

// ----- interaction -----
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

root.addEventListener('mousedown', e => {
  if (e.button !== 0) return;

  // Prevent new window creation if clicking on address bar or resize handles
  const target = e.target as HTMLElement;
  if (
    target.closest('.muon-urlbar') ||
    target.closest('.muon-resize-handle')
  ) {
    return;
  }

  dragStartX = e.clientX;
  dragStartY = e.clientY;
  isDragging = true;

  // create ghost rectangle
  const ghost = document.createElement('div');
  ghost.id = 'ghost';
  ghost.className = 'absolute border border-dashed border-sky-400 bg-sky-400/10';
  desk.appendChild(ghost);

  const updateGhost = (ev: MouseEvent) => {
    const gx = Math.min(dragStartX, ev.clientX);
    const gy = Math.min(dragStartY, ev.clientY);
    const gw = Math.abs(ev.clientX - dragStartX);
    const gh = Math.abs(ev.clientY - dragStartY);
    const deskRect = root.getBoundingClientRect();
    ghost.style.left = ((gx - deskRect.left - offsetX) / scale) + 'px';
    ghost.style.top = ((gy - deskRect.top - offsetY) / scale) + 'px';
    ghost.style.width = gw / scale + 'px';
    ghost.style.height = gh / scale + 'px';
  };

  const move = (ev: MouseEvent) => updateGhost(ev);
  const up = async (ev: MouseEvent) => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    updateGhost(ev);

    const gw = parseFloat(ghost.style.width);
    const gh = parseFloat(ghost.style.height);
    if (gw > 32 && gh > 32) {
      // Always create window with default URL, focus address bar for entry
      const wdata: WindowData = {
        id: crypto.randomUUID(),
        x: parseFloat(ghost.style.left),
        y: parseFloat(ghost.style.top),
        w: gw,
        h: gh,
        url: 'https://exa.ai/search',
        scaleAtCreation: scale
      };
      windows.push(wdata);
      const el = createWindowElement(wdata, true); // focus address bar
      save();
    }
    ghost.remove();
    isDragging = false;
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
});

// Pan or zoom with wheel
root.addEventListener('wheel', e => {
  // Allow zooming only if >5% of screen is visible desktop
  const deskRect = root.getBoundingClientRect();
  const visibleDeskArea = (deskRect.width * deskRect.height) * 0.05;
  
  // Calculate visible non-webview area
  let nonWebviewArea = 0;
  document.querySelectorAll('.muon-window').forEach((el: Element) => {
    const win = el as HTMLElement;
    const winRect = win.getBoundingClientRect();
    nonWebviewArea += winRect.width * winRect.height;
  });
  
  const totalArea = deskRect.width * deskRect.height;
  const webviewArea = totalArea - nonWebviewArea;
  
  // Block zoom if too much of screen is webview/address bar
  if (webviewArea > totalArea * 0.95) {
    return;
  }

  // Allow panning/zooming unless actively editing an input
  if ((e.target as HTMLElement).tagName === 'INPUT' &&
      (e.target as HTMLElement).matches(':focus')) {
    return;
  }
  
  e.preventDefault();
  if (e.metaKey || e.ctrlKey) {
    // zoom centered on cursor
    const zoomIntensity = 0.001;
    const delta = -e.deltaY * zoomIntensity;
    const prevScale = scale;
    const mx = e.clientX - root.getBoundingClientRect().left;
    const my = e.clientY - root.getBoundingClientRect().top;
    // compute world coords before zoom
    const wx = (mx - offsetX) / scale;
    const wy = (my - offsetY) / scale;

    scale = Math.min(Math.max(0.25, scale * (1 + delta)), 4);

    // after zoom, adjust offset so (wx, wy) stays under cursor
    offsetX = mx - wx * scale;
    offsetY = my - wy * scale;
  } else {
    // pan
    offsetX -= e.deltaX / scale;
    offsetY -= e.deltaY / scale;
  }
  applyTransform();
}, { passive: false });

// Click on a window locks interaction, click on desktop unlocks
desk.addEventListener('mousedown', e => {
  muonActiveWindow = null;
});
desk.addEventListener('click', e => {
  muonActiveWindow = null;
});

// Add resize handle to all windows
function addResizeHandle(cont: HTMLElement, w: WindowData) {
  // Helper to create a handle
  function makeHandle(edge: string, cursor: string, style: Partial<CSSStyleDeclaration>, resizeFn: (dx: number, dy: number, state: any) => void) {
    const handle = document.createElement('div');
    handle.className = 'muon-resize-handle muon-resize-' + edge;
    Object.assign(handle.style, style);
    handle.style.position = 'absolute';
    handle.style.zIndex = '20';
    handle.style.cursor = cursor;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = parseFloat(cont.style.width);
      const startHeight = parseFloat(cont.style.height);
      const startLeft = parseFloat(cont.style.left);
      const startTop = parseFloat(cont.style.top);

      const doResize = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        resizeFn(dx, dy, { startWidth, startHeight, startLeft, startTop });

        // Update webview size
        const webview = cont.querySelector('webview') as HTMLElement | null;
        if (webview) {
          const barHeight = 24 * (w.scaleAtCreation ? 1 / w.scaleAtCreation : 1);
          webview.style.height = `calc(100% - ${barHeight}px)`;
        }
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);

        // Update window data
        const win = windows.find(win => win.id === w.id);
        if (win) {
          win.w = parseFloat(cont.style.width);
          win.h = parseFloat(cont.style.height);
          win.x = parseFloat(cont.style.left);
          win.y = parseFloat(cont.style.top);
          save();
        }
      };

      document.addEventListener('mousemove', doResize);
      document.addEventListener('mouseup', stopResize);
    });
    cont.appendChild(handle);
  }

  // Corner (bottom-right)
  makeHandle(
    'corner',
    'nwse-resize',
    { right: '0', bottom: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight }) => {
      const minWidth = 200, minHeight = 200;
      const newWidth = Math.max(minWidth, startWidth + dx);
      const newHeight = Math.max(minHeight, startHeight + dy);
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Right edge
  makeHandle(
    'right',
    'ew-resize',
    { right: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth }) => {
      const minWidth = 200;
      const newWidth = Math.max(minWidth, startWidth + dx);
      cont.style.width = newWidth + 'px';
    }
  );
  // Bottom edge
  makeHandle(
    'bottom',
    'ns-resize',
    { left: '12px', right: '12px', bottom: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight }) => {
      const minHeight = 200;
      const newHeight = Math.max(minHeight, startHeight + dy);
      cont.style.height = newHeight + 'px';
    }
  );
  // Left edge
  makeHandle(
    'left',
    'ew-resize',
    { left: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth, startLeft }) => {
      const minWidth = 200;
      let newWidth = Math.max(minWidth, startWidth - dx);
      let newLeft = startLeft + dx;
      if (newWidth === minWidth) newLeft = startLeft + (startWidth - minWidth);
      cont.style.left = newLeft + 'px';
      cont.style.width = newWidth + 'px';
    }
  );
  // Top edge
  makeHandle(
    'top',
    'ns-resize',
    { left: '12px', right: '12px', top: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight, startTop }) => {
      const minHeight = 200;
      let newHeight = Math.max(minHeight, startHeight - dy);
      let newTop = startTop + dy;
      if (newHeight === minHeight) newTop = startTop + (startHeight - minHeight);
      cont.style.top = newTop + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
}

// Add drag functionality to address bar
function addAddressBarDrag(urlBar: HTMLInputElement, cont: HTMLElement, w: WindowData) {
  let startX: number, startY: number;
  let startLeft: number, startTop: number;
  
  urlBar.addEventListener('mousedown', (e) => {
    if (e.target !== urlBar) return;
    
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(cont.style.left);
    startTop = parseFloat(cont.style.top);
    
    const doDrag = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      cont.style.left = (startLeft + dx) + 'px';
      cont.style.top = (startTop + dy) + 'px';
    };
    
    const stopDrag = (e: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      
      // Update window data only if mouse moved significantly
      if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
        const win = windows.find(win => win.id === w.id);
        if (win) {
          win.x = parseFloat(cont.style.left);
          win.y = parseFloat(cont.style.top);
          save();
        }
      }
    };
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  });
}

// Save shortcut
root.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
});

function save () {
  window.electronAPI.saveState({
    windows,
    transform: { scale, x: offsetX, y: offsetY }
  });
}

// ---- load state ----
(async () => {
  const saved = await window.electronAPI.loadState();
  if (saved) {
    windows = saved.windows || [];
    scale = saved.transform?.scale || 1;
    offsetX = saved.transform?.x || 0;
    offsetY = saved.transform?.y || 0;
  }
  rebuild();
})();
