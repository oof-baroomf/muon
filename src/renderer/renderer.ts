import './styles.css';
import { WindowData, addResizeHandle, addAddressBarDrag } from './windowManager';
import { DesktopState, loadState, saveState } from './state';

const root = document.getElementById('root') as HTMLElement;
root.tabIndex = 0; // allow key focus

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let windows: WindowData[] = [];
let muonActiveWindow: HTMLElement | null = null;

const desk = document.createElement('div');
desk.id = 'muon-desktop';
desk.className = 'absolute inset-0 origin-top-left will-change-transform';
root.appendChild(desk);

function applyTransform () {
  desk.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
  const bgSize = 32 * scale;
  root.style.backgroundSize = `${bgSize}px ${bgSize}px`;
  root.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
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

  // --- New Top Bar (Layer 1): Navigation + Drag area + Close tab ---
  const barHeight = 24;
  const topBar = document.createElement('div');
  topBar.className = 'muon-topbar-container';
  topBar.style.position = 'absolute';
  topBar.style.top = '0';
  topBar.style.left = '0';
  topBar.style.right = '0';
  topBar.style.height = `${barHeight}px`;
  topBar.style.display = 'flex';
  topBar.style.alignItems = 'center';
  topBar.style.zIndex = '3';
  topBar.style.background = '#23232a';

  // --- Per-window zoom state using WeakMap to avoid TS errors ---
  type ZoomState = { zoomed: boolean, origScale: number, origOffsetX: number, origOffsetY: number };
  const zoomStateMap = (window as any)._muonZoomStateMap as WeakMap<HTMLElement, ZoomState> || new WeakMap<HTMLElement, ZoomState>();
  (window as any)._muonZoomStateMap = zoomStateMap;

  // Double-click on top bar (or any child) to zoom/center window, double-click again to restore
  topBar.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let state = zoomStateMap.get(cont);
    if (!state) {
      state = { zoomed: false, origScale: 1, origOffsetX: 0, origOffsetY: 0 };
      zoomStateMap.set(cont, state);
    }

    if (state.zoomed) {
      // Animate back to original
      const targetScale = state.origScale;
      const targetOffsetX = state.origOffsetX;
      const targetOffsetY = state.origOffsetY;
      const startScale = scale;
      const startOffsetX = offsetX;
      const startOffsetY = offsetY;
      const duration = 300;
      const startTime = performance.now();

      function animateRestore(now: number) {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        scale = startScale + (targetScale - startScale) * ease;
        offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
        offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease;
        applyTransform();
        if (t < 1) {
          requestAnimationFrame(animateRestore);
        } else {
          scale = targetScale;
          offsetX = targetOffsetX;
          offsetY = targetOffsetY;
          applyTransform();
        }
      }
      requestAnimationFrame(animateRestore);
      state.zoomed = false;
      return;
    }

    // Store original transform
    state.origScale = scale;
    state.origOffsetX = offsetX;
    state.origOffsetY = offsetY;

    // Use desk/world coordinates for accurate fit
    const margin = 32;
    const winW = cont.offsetWidth;
    const winH = cont.offsetHeight;
    const winX = parseFloat(cont.style.left);
    const winY = parseFloat(cont.style.top);

    const viewportW = root.clientWidth;
    const viewportH = root.clientHeight;

    // Calculate scale to fit window in viewport with margins
    const scaleX = (viewportW - 2 * margin) / winW;
    const scaleY = (viewportH - 2 * margin) / winH;
    const targetScale = Math.min(scaleX, scaleY, 4);

    // Center window in viewport after scaling
    const winCenterX = winX + winW / 2;
    const winCenterY = winY + winH / 2;
    const viewportCenterX = viewportW / 2;
    const viewportCenterY = viewportH / 2;

    // Offset so that after scaling, window center is at viewport center
    const targetOffsetX = viewportCenterX - winCenterX * targetScale;
    const targetOffsetY = viewportCenterY - winCenterY * targetScale;

    // Animate transform
    const startScale = scale;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;
    const duration = 300;
    const startTime = performance.now();

    function animateZoom(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      // Ease in-out
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      scale = startScale + (targetScale - startScale) * ease;
      offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
      offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease;
      applyTransform();
      if (t < 1) {
        requestAnimationFrame(animateZoom);
      } else {
        // Snap to final values
        scale = targetScale;
        offsetX = targetOffsetX;
        offsetY = targetOffsetY;
        applyTransform();
      }
    }
    requestAnimationFrame(animateZoom);
    state.zoomed = true;
  });

  // Navigation controls
  const navControls = document.createElement('div');
  navControls.className = 'muon-nav-controls';
  navControls.style.display = 'flex';
  navControls.style.alignItems = 'center';
  navControls.style.gap = '2px';
  navControls.style.marginLeft = '4px';

  // Button helper (removed duplicate makeNavBtn)

  // Navigation button references (handlers will be assigned after webview is created)
  let backBtn: HTMLButtonElement, fwdBtn: HTMLButtonElement, reloadBtn: HTMLButtonElement, stopBtn: HTMLButtonElement;

  // Drag area (fills most of the top bar, draggable)
  const dragArea = document.createElement('div');
  dragArea.className = 'muon-drag-area';
  dragArea.style.flex = '1 1 0%';
  dragArea.style.height = `${barHeight}px`;
  dragArea.style.cursor = 'grab';
  dragArea.style.userSelect = 'none';
  dragArea.style.background = 'transparent';

  // Drag logic for dragArea
  dragArea.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    let startX = e.clientX;
    let startY = e.clientY;
    let startLeft = parseFloat(cont.style.left);
    let startTop = parseFloat(cont.style.top);

    const doDrag = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      cont.style.left = (startLeft + dx) + 'px';
      cont.style.top = (startTop + dy) + 'px';
    };

    const stopDrag = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      // Save position if moved
      if (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2) {
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
  });

  // Close tab button (right side)
  const removeBtn = document.createElement('button');
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove window';
  removeBtn.className = 'muon-remove bg-transparent border-none leading-none cursor-pointer';
  removeBtn.style.fontSize = `18px`;
  removeBtn.style.width = `${barHeight - 4}px`;
  removeBtn.style.height = `${barHeight - 4}px`;
  removeBtn.style.display = 'flex';
  removeBtn.style.alignItems = 'center';
  removeBtn.style.justifyContent = 'center';
  removeBtn.style.marginRight = '2px';
  removeBtn.style.zIndex = '4';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    windows = windows.filter(win => win.id !== w.id);
    cont.remove();
    save();
  };

  topBar.appendChild(navControls);
  topBar.appendChild(dragArea);
  topBar.appendChild(removeBtn);

  // --- Address Bar (Layer 2): Only URL input ---
  const barContainer = document.createElement('div');
  barContainer.className = 'muon-urlbar-container';
  barContainer.style.position = 'absolute';
  barContainer.style.top = `${barHeight}px`;
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
  urlBar.className = 'muon-urlbar px-2 py-1 text-xs outline-none';
  urlBar.style.flex = '1 1 0%';
  urlBar.style.height = `${barHeight - 4}px`;
  urlBar.style.fontSize = `12px`;
  urlBar.style.border = 'none';
  urlBar.style.background = 'transparent';
  urlBar.style.color = '#e5e5e5';
  urlBar.style.marginRight = '2px';
  urlBar.style.textOverflow = 'ellipsis';
  urlBar.style.overflow = 'hidden';
  urlBar.style.whiteSpace = 'nowrap';

  barContainer.appendChild(urlBar);

  // Webview fills the window except for the two bars
  const webview = document.createElement('webview') as Electron.WebviewTag;
  webview.className = 'w-full';
  webview.src = w.url || 'https://www.google.com/search';
  webview.partition = `persist:muon-${w.id}`;
  webview.style.position = 'absolute';
  webview.style.left = '0';
  webview.style.width = '100%';
  webview.style.border = 'none';
  webview.style.top = `${barHeight * 2}px`;
  webview.style.height = `calc(100% - ${barHeight * 2}px)`;
  webview.style.zIndex = '0'; // Ensure webview stays behind bars

  // Now that webview exists, create nav buttons and wire up handlers
  function makeNavBtn(label: string, title: string, handler: () => void) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.className = 'muon-nav-btn bg-transparent border-none leading-none cursor-pointer';
    btn.style.fontSize = '14px';
    btn.style.width = `${barHeight - 6}px`;
    btn.style.height = `${barHeight - 6}px`;
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.borderRadius = '4px';
    btn.style.color = '#aaa';
    btn.style.transition = 'color 0.15s, background 0.15s';
    btn.onmouseenter = () => { btn.style.color = '#fff'; btn.style.background = '#333'; };
    btn.onmouseleave = () => { btn.style.color = '#aaa'; btn.style.background = 'transparent'; };
    btn.onclick = (e) => { e.stopPropagation(); handler(); };
    return btn;
  }
  backBtn = makeNavBtn('←', 'Back', () => { if (webview) webview.goBack(); });
  fwdBtn = makeNavBtn('→', 'Forward', () => { if (webview) webview.goForward(); });
  reloadBtn = makeNavBtn('⟳', 'Reload', () => { if (webview) webview.reload(); });
  stopBtn = makeNavBtn('⨉', 'Stop', () => { if (webview) webview.stop(); });

  // Insert nav controls at the start of the topBar (before drag area and close button)
  topBar.insertBefore(stopBtn, topBar.firstChild);
  topBar.insertBefore(reloadBtn, topBar.firstChild);
  topBar.insertBefore(fwdBtn, topBar.firstChild);
  topBar.insertBefore(backBtn, topBar.firstChild);

  urlBar.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      let val = urlBar.value.trim();
      if (!/^(https?:|file:)/i.test(val)) {
        if (/^[\w-]+\.[\w-]+/.test(val)) {
          val = 'https://' + val;
        } else {
          val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
        }
      }
      w.url = val;
      webview.src = val;
    }
  });

  // Keep address bar in sync with webview navigation
  webview.addEventListener('did-navigate', (event: any) => {
    urlBar.value = webview.getURL();
    w.url = webview.getURL();
  });
  webview.addEventListener('did-navigate-in-page', (event: any) => {
    urlBar.value = webview.getURL();
    w.url = webview.getURL();
  });

  // Adjust zoom based on the container's width, assuming 800px is the "default"
  const adjustZoom = () => {
    const newZoom = cont.offsetWidth / 800;
    webview.setZoomFactor(newZoom);
  };

  webview.addEventListener('dom-ready', adjustZoom);

  cont.appendChild(topBar);
  cont.appendChild(barContainer);
  cont.appendChild(webview);

  // Autofocus address bar if requested
  if (focusBar) {
    setTimeout(() => urlBar.focus(), 0);
  }

  // double click to center this window (ignore if dblclick was on url bar)
  cont.addEventListener('dblclick', e => {
    if ((e.target as HTMLElement).closest('.muon-urlbar')) return;
    e.stopPropagation();
    // center on window
    const bounds = cont.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2 - root.clientWidth / 2;
    const cy = bounds.top + bounds.height / 2 - root.clientHeight / 2;
    offsetX -= cx / scale;
    offsetY -= cy / scale;
    applyTransform();
  });

  addResizeHandle(cont, w, scale, windows, save);
  desk.appendChild(cont);
  return cont;
}

function rebuild () {
  desk.innerHTML = '';
  windows.forEach(w => {
    const cont = createWindowElement(w, false);
    addResizeHandle(cont, w, scale, windows, save);

    // Add drag to address bar
    const urlBar = cont.querySelector('.muon-urlbar') as HTMLInputElement;
    if (urlBar) {
      addAddressBarDrag(urlBar, cont, w, scale, windows, save);
    }
  });
  applyTransform();
}

// Tiny custom URL-input overlay to replace prompt()
/**
 * askUrl is now a no-op; window creation will focus the address bar directly.
 */
async function askUrl(def = 'https://www.google.com'): Promise<string | null> {
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
        url: 'https://www.google.com/search'
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


// Save shortcut
root.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
});

function save () {
  saveState(windows, { scale, x: offsetX, y: offsetY });
}

// ---- load state ----
(async () => {
  const state: DesktopState = await loadState();
  windows = state.windows;
  scale = state.transform.scale;
  offsetX = state.transform.x;
  offsetY = state.transform.y;
  rebuild();
})();
