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

const windowElements = new Map<string, HTMLElement>();

let searchOverlay: HTMLElement | null = null;
let searchInput: HTMLInputElement | null = null;
let searchList: HTMLElement | null = null;
let searchResults: { win: WindowData; element: HTMLElement }[] = [];
let searchIndex = -1;

const desk = document.createElement('div');
desk.id = 'muon-desktop';
desk.className = 'absolute inset-0 origin-top-left will-change-transform';
root.appendChild(desk);

// Debounce timer for UI re-rendering
let uiRerenderTimeout: NodeJS.Timeout | null = null;

function updateAllWindowsBounds() {
  for (const w of windows) {
    const cont = windowElements.get(w.id);
    if (cont) {
      const viewContainer = cont.querySelector('.muon-view-container') as HTMLElement;
      if(viewContainer) {
        const rect = viewContainer.getBoundingClientRect();
        window.electronAPI.send('view:set-bounds', w.id, {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    }
  }
}

function updateAllWindowsZoom() {
  for (const w of windows) {
    const cont = windowElements.get(w.id);
    if (cont) {
      const newZoom = scale * (cont.offsetWidth / 800);
      window.electronAPI.send('view:set-zoom-factor', w.id, newZoom);
    }
  }
}

function applyTransform () {
  desk.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
  const gridSize = 32 * scale;
  root.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  root.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  updateAllWindowsBounds();
  updateAllWindowsZoom();
  
  // Force immediate background repaint to prevent glitches during rapid transforms
  root.style.backgroundRepeat = 'repeat';
  // Trigger a layout to ensure background is properly updated
  root.offsetHeight;
  
  // Debounce UI re-rendering to only happen when transform operations stop
  debouncedUIRerender();
}

function debouncedUIRerender() {
  // Clear any existing timeout
  if (uiRerenderTimeout) {
    clearTimeout(uiRerenderTimeout);
  }
  
  // Set a new timeout to re-render UI after operations stop
  uiRerenderTimeout = setTimeout(() => {
    forceUIRerender();
    uiRerenderTimeout = null;
  }, 150); // Wait 150ms after last transform change
}

function forceUIRerender() {
  console.log('Force UI rerender called, scale:', scale);
  
  // Force repaint of ALL UI elements including icons
  const allUIElements = document.querySelectorAll('.muon-topbar-container, .muon-urlbar-container, .muon-nav-btn, .muon-urlbar, .muon-remove, .muon-drag-area, .muon-nav-controls');
  
  allUIElements.forEach((element: Element) => {
    const htmlElement = element as HTMLElement;
    
    // Force multiple repaints with different techniques
    
    // Method 1: Force layout recalculation
    const originalDisplay = htmlElement.style.display;
    htmlElement.style.display = 'none';
    htmlElement.offsetHeight; // Trigger layout
    htmlElement.style.display = originalDisplay;
    
    // Method 2: Force opacity change
    const originalOpacity = htmlElement.style.opacity;
    htmlElement.style.opacity = '0.999';
    htmlElement.offsetHeight; // Trigger layout
    htmlElement.style.opacity = originalOpacity || '';
    
    // Method 3: Force transform change
    const originalTransform = htmlElement.style.transform;
    htmlElement.style.transform = 'translateZ(0.1px)';
    htmlElement.offsetHeight; // Trigger layout
    htmlElement.style.transform = originalTransform || '';
    
    // Method 4: Force font size recalculation for text elements
    if (htmlElement.tagName === 'BUTTON' || htmlElement.tagName === 'INPUT' || htmlElement.textContent) {
      const computedStyle = window.getComputedStyle(htmlElement);
      const fontSize = parseFloat(computedStyle.fontSize);
      if (fontSize) {
        // Temporarily change font size to force re-render
        const originalFontSize = htmlElement.style.fontSize;
        htmlElement.style.fontSize = (fontSize + 0.001) + 'px';
        htmlElement.offsetHeight; // Trigger layout
        htmlElement.style.fontSize = originalFontSize || '';
      }
    }
  });
  
  // Also force a global repaint by temporarily modifying the container
  const originalZoom = desk.style.zoom;
  desk.style.zoom = (1.0001).toString();
  desk.offsetHeight; // Trigger layout
  desk.style.zoom = originalZoom || '';
  
  console.log('UI rerender completed');
}

// Extracted zoom/center functionality for reuse
function zoomAndCenterWindow(cont: HTMLElement) {
  // --- Per-window zoom state using WeakMap to avoid TS errors ---
  type ZoomState = { zoomed: boolean, origScale: number, origOffsetX: number, origOffsetY: number };
  const zoomStateMap = (window as any)._muonZoomStateMap as WeakMap<HTMLElement, ZoomState> || new WeakMap<HTMLElement, ZoomState>();
  (window as any)._muonZoomStateMap = zoomStateMap;

  let state = zoomStateMap.get(cont);
  if (!state) {
    // Initialize with current global transform values
    state = { zoomed: false, origScale: scale, origOffsetX: offsetX, origOffsetY: offsetY };
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
}

function createWindowElement (w: WindowData, focusBar = false): HTMLElement {
  const cont = document.createElement('div');
  windowElements.set(w.id, cont);
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
    zoomAndCenterWindow(cont);
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
      updateBounds();
    };

    const stopDrag = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      updateBounds();
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
    windowElements.delete(w.id);
    window.electronAPI.send('view:destroy', w.id);
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

  const viewContainer = document.createElement('div');
  viewContainer.className = 'muon-view-container';
  viewContainer.style.position = 'absolute';
  viewContainer.style.left = '0';
  viewContainer.style.top = `${barHeight * 2}px`;
  viewContainer.style.width = '100%';
  viewContainer.style.height = `calc(100% - ${barHeight * 2}px)`;
  viewContainer.style.zIndex = '0';

  window.electronAPI.send('view:create', w.id, w.url || 'https://www.google.com/search');

  const updateBounds = () => {
    const rect = viewContainer.getBoundingClientRect();
    window.electronAPI.send('view:set-bounds', w.id, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });
  }

  // Now that the view is created, create nav buttons and wire up handlers
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
  backBtn = makeNavBtn('←', 'Back', () => window.electronAPI.send('view:back', w.id));
  fwdBtn = makeNavBtn('→', 'Forward', () => window.electronAPI.send('view:forward', w.id));
  reloadBtn = makeNavBtn('⟳', 'Reload', () => window.electronAPI.send('view:reload', w.id));
  stopBtn = makeNavBtn('⨉', 'Stop', () => window.electronAPI.send('view:stop', w.id));

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
      window.electronAPI.send('view:load-url', w.id, val);
    }
  });

  const updateTitle = (title: string) => { w.title = title; };
  
  window.electronAPI.receive(`view:did-navigate:${w.id}`, (url: string) => {
    urlBar.value = url;
    w.url = url;
  });
  window.electronAPI.receive(`view:did-navigate-in-page:${w.id}`, (url: string) => {
    urlBar.value = url;
    w.url = url;
  });
  window.electronAPI.receive(`view:page-title-updated:${w.id}`, (title: string) => {
    updateTitle(title);
  });

  // Adjust zoom based on the container's width, assuming 800px is the "default"
  const adjustZoom = () => {
    const newZoom = scale * (cont.offsetWidth / 800);
    window.electronAPI.send('view:set-zoom-factor', w.id, newZoom);
  };

  new ResizeObserver(updateBounds).observe(cont);
  new ResizeObserver(adjustZoom).observe(cont);

  cont.appendChild(topBar);
  cont.appendChild(barContainer);
  cont.appendChild(viewContainer);

  // Autofocus address bar if requested
  if (focusBar) {
    setTimeout(() => urlBar.focus(), 0);
  }

  // double click to center this window (ignore if dblclick was on url bar or resize handles)
  cont.addEventListener('dblclick', e => {
    if ((e.target as HTMLElement).closest('.muon-urlbar') || 
        (e.target as HTMLElement).closest('.muon-resize-handle')) return;
    e.stopPropagation();
    // center on window
    const bounds = cont.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2 - root.clientWidth / 2;
    const cy = bounds.top + bounds.height / 2 - root.clientHeight / 2;
    offsetX -= cx / scale;
    offsetY -= cy / scale;
    applyTransform();
  });

  // Track this window as active when clicked anywhere
  const setActiveWindow = () => {
    console.log('Setting active window:', cont);
    muonActiveWindow = cont;
    console.log('Active window is now:', muonActiveWindow);
  };

  // Add click handlers to all clickable elements
  cont.addEventListener('mousedown', setActiveWindow);
  topBar.addEventListener('mousedown', setActiveWindow);
  barContainer.addEventListener('mousedown', setActiveWindow);
  urlBar.addEventListener('mousedown', setActiveWindow);
  
  // Add handler to view when it's ready
  window.electronAPI.receive(`view:did-finish-load:${w.id}`, () => {
    // The view is now interactable, but we can't directly add a mousedown listener.
    // The main process will handle focus.
  });

  addResizeHandle(cont, w, scale, windows, save, updateBounds);
  
  if (urlBar) {
    addAddressBarDrag(urlBar, cont, w, scale, windows, save, updateBounds);
  }

  desk.appendChild(cont);
  return cont;
}

function rebuild () {
  desk.innerHTML = '';
  windowElements.clear();
  windows.forEach((w, index) => {
    const cont = createWindowElement(w, false);
    
    // Set the first window as active if no active window is set
    if (index === 0 && !muonActiveWindow) {
      muonActiveWindow = cont;
      console.log('Set first window as active during rebuild:', cont);
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

function fuzzyMatch(text: string, query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  text = text.toLowerCase();
  return tokens.every(t => text.includes(t));
}

function showSearch() {
  if (searchOverlay) return;
  searchOverlay = document.createElement('div');
  searchOverlay.className = 'absolute inset-0 bg-black/60 flex items-start justify-center pt-24';
  searchOverlay.style.zIndex = '50';

  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) {
      hideSearch();
    }
  });

  const box = document.createElement('div');
  box.className = 'bg-zinc-800 border border-zinc-600 rounded-lg w-96 overflow-hidden';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search windows...';
  input.className = 'w-full bg-transparent px-3 py-2 border-b border-zinc-600 outline-none text-zinc-200';

  const list = document.createElement('div');
  list.className = 'max-h-72 overflow-y-auto';

  box.appendChild(input);
  box.appendChild(list);
  searchOverlay.appendChild(box);
  root.appendChild(searchOverlay);

  searchInput = input;
  searchList = list;
  searchIndex = -1;
  updateSearchResults();

  setTimeout(() => input.focus(), 0);

  input.addEventListener('input', () => { searchIndex = 0; updateSearchResults(); });
}

function hideSearch() {
  if (!searchOverlay) return;
  searchOverlay.remove();
  searchOverlay = null;
  searchInput = null;
  searchList = null;
  searchResults = [];
  searchIndex = -1;
}

function updateSearchResults() {
  if (!searchList || !searchInput) return;
  const query = searchInput.value;
  searchResults = windows
    .map(w => ({ win: w, element: windowElements.get(w.id) as HTMLElement }))
    .filter(r => r.element && fuzzyMatch(r.win.title || r.win.url, query));

  searchList.innerHTML = '';
  searchResults.forEach((r, idx) => {
    const item = document.createElement('div');
    item.textContent = r.win.title || r.win.url;
    item.className = 'px-3 py-2 text-sm cursor-pointer hover:bg-zinc-700';
    item.addEventListener('mouseenter', () => { searchIndex = idx; refreshSearchHighlight(); });
    item.addEventListener('click', () => selectSearchResult(idx));
    searchList!.appendChild(item);
  });
  refreshSearchHighlight();
}

function refreshSearchHighlight() {
  if (!searchList) return;
  Array.from(searchList.children).forEach((el, i) => {
    (el as HTMLElement).style.background = i === searchIndex ? '#333' : 'transparent';
  });
}

function selectSearchResult(index: number) {
  const res = searchResults[index];
  if (!res) return;
  muonActiveWindow = res.element;
  hideSearch();
  zoomAndCenterWindow(res.element);
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
  ghost.className = 'absolute border border-gray-500 bg-gray-500/10';
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
      muonActiveWindow = el; // Set newly created window as active
      console.log('Set newly created window as active:', el);
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



// Keyboard shortcuts - listen on document to ensure they work globally
document.addEventListener('keydown', e => {
  console.log('Key event:', e.key, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey, 'activeWindow:', muonActiveWindow);

  if (searchOverlay) {
    if (e.key === 'Escape') { hideSearch(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (searchResults.length){ searchIndex = (searchIndex + 1) % searchResults.length; refreshSearchHighlight(); } return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (searchResults.length){ searchIndex = (searchIndex - 1 + searchResults.length) % searchResults.length; refreshSearchHighlight(); } return; }
    if (e.key === 'Enter') { e.preventDefault(); if (searchIndex === -1 && searchResults.length) searchIndex = 0; selectSearchResult(searchIndex); return; }
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (searchOverlay) {
      hideSearch();
    } else {
      showSearch();
    }
    return;
  }
  
  // Save shortcut
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    console.log('Save shortcut triggered');
    e.preventDefault();
    save();
    return;
  }
  
  // Zoom/center hotkey for active window (Cmd/Ctrl + D)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
    console.log('Zoom shortcut triggered, activeWindow exists:', !!muonActiveWindow);
    e.preventDefault();
    
    let targetWindow = muonActiveWindow;
    
    // Fallback: if no active window, use the first available window
    if (!targetWindow && windows.length > 0) {
      const firstWindowElement = desk.querySelector('.muon-window') as HTMLElement;
      if (firstWindowElement) {
        targetWindow = firstWindowElement;
        muonActiveWindow = firstWindowElement; // Set it as active for future use
        console.log('Using fallback window:', targetWindow);
      }
    }
    
    if (targetWindow) {
      console.log('Calling zoomAndCenterWindow');
      zoomAndCenterWindow(targetWindow);
    } else {
      console.log('No window available for zoom');
    }
    return;
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
