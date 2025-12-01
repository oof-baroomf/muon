import './styles.css';
import { WindowData, addResizeHandle, addAddressBarDrag } from './windowManager';
import { DesktopState, loadState, saveState } from './state';
import { TransformState, applyTransform, zoomAndCenterWindow, initPanZoom } from './desktopTransform';
import { initSearchOverlay } from './searchOverlay';
import { initKeyboardShortcuts } from './keyboardShortcuts';
import { loadConfig, applyWindowLayoutVars, getWindowLayout } from './settings/appConfig';
import { applyGridStyle } from './settings/gridStyles';
import { sanitizeNotePath, setupNoteEditor } from './notes';
import { Rect, clampDrag, clampMove, collides } from './collision';

const root = document.getElementById('root') as HTMLElement;
root.tabIndex = 0;

const desk = document.createElement('div');
desk.id = 'muon-desktop';
desk.className = 'absolute inset-0 origin-top-left will-change-transform';
root.appendChild(desk);

let windows: WindowData[] = [];
let muonActiveWindow: HTMLElement | null = null;

const windowElements = new Map<string, HTMLElement>();
const windowCleanups = new Map<string, () => void>();

const transform: TransformState = { scale: 1, offsetX: 0, offsetY: 0 };

function apply() {
  applyTransform(desk, root, windows, windowElements, transform);
}

initPanZoom(root, transform, apply);

initSearchOverlay({
  root,
  getWindows: () => windows,
  windowElements,
  setActiveWindow: (el) => { muonActiveWindow = el; },
  transform,
  applyTransform: apply
});

initKeyboardShortcuts({
  desk,
  getWindows: () => windows,
  getActiveWindow: () => muonActiveWindow,
  setActiveWindow: (el) => { muonActiveWindow = el; },
  save,
  transform,
  applyTransform: apply,
  root
});

function createWindowElement (w: WindowData, focusBar = false): HTMLElement {
  const subscriptions: Array<() => void> = [];
  const resizeObservers: ResizeObserver[] = [];
  const layout = getWindowLayout();

  if (w.notePath) {
    const name = w.notePath.split('/').pop()!.replace(/\.md$/, '');
    w.title = w.title || name;
  } else if (!w.url) {
    w.title = w.title || 'Blank';
  }
  const cont = document.createElement('div');
  windowElements.set(w.id, cont);
  cont.className = 'muon-window absolute overflow-hidden shadow-lg';
  cont.style.left = w.x + 'px';
  cont.style.top = w.y + 'px';
  cont.style.width = Math.max(w.w, layout.minWindow.width) + 'px';
  cont.style.height = Math.max(w.h, layout.minWindow.height) + 'px';
  cont.style.transform = '';
  cont.style.transformOrigin = 'top left';
  cont.dataset.id = w.id;
  cont.style.zIndex = '1';

  const topBar = document.createElement('div');
  topBar.className = 'muon-topbar-container';

  topBar.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomAndCenterWindow(cont, root, transform, apply);
  });

  const navControls = document.createElement('div');
  navControls.className = 'muon-nav-controls';

  let backBtn: HTMLButtonElement, fwdBtn: HTMLButtonElement, reloadBtn: HTMLButtonElement, stopBtn: HTMLButtonElement;

  const dragArea = document.createElement('div');
  dragArea.className = 'muon-drag-area';

  dragArea.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    let startX = e.clientX;
    let startY = e.clientY;
    let startLeft = parseFloat(cont.style.left);
    let startTop = parseFloat(cont.style.top);
    let lastLeft = startLeft;
    let lastTop = startTop;

    const doDrag = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / transform.scale;
      const dy = (ev.clientY - startY) / transform.scale;
      const width = parseFloat(cont.style.width);
      const height = parseFloat(cont.style.height);
      const rect = clampMove(
        { x: startLeft + dx, y: startTop + dy, w: width, h: height },
        { x: lastLeft, y: lastTop, w: width, h: height },
        windows,
        w.id
      );
      cont.style.left = rect.x + 'px';
      cont.style.top = rect.y + 'px';
      lastLeft = rect.x;
      lastTop = rect.y;
      updateBounds();
    };

    const stopDrag = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      updateBounds();
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

  const removeBtn = document.createElement('button');
  removeBtn.textContent = layout.removeButton.label;
  removeBtn.title = layout.removeButton.title;
  removeBtn.className = 'muon-remove';
  removeBtn.style.zIndex = '4';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    const cleanup = windowCleanups.get(w.id);
    cleanup?.();
    windowCleanups.delete(w.id);
    windows = windows.filter(win => win.id !== w.id);
    windowElements.delete(w.id);
    window.electronAPI.send('view:destroy', w.id);
    cont.remove();
    save();
  };

  topBar.appendChild(navControls);
  topBar.appendChild(dragArea);
  topBar.appendChild(removeBtn);

  const barContainer = document.createElement('div');
  barContainer.className = 'muon-urlbar-container';

  const urlBar = document.createElement('input');
  urlBar.type = 'text';
  urlBar.value = w.notePath ? '.' + w.notePath.replace(/\.md$/, '') : w.url;
  urlBar.addEventListener('focus', () => { setTimeout(() => urlBar.select(), 0); });
  urlBar.addEventListener('click', (e) => {
    if (document.activeElement !== urlBar) {
      urlBar.focus();
      e.preventDefault();
    }
  });
  urlBar.className = 'muon-urlbar px-2 py-1 text-xs outline-none';

  barContainer.appendChild(urlBar);

  const viewContainer = document.createElement('div');
  viewContainer.className = 'muon-view-container';

  if (w.notePath) {
    setupNoteEditor(viewContainer, w.notePath);
  } else {
    window.electronAPI.send('view:create', w.id, w.url || '');
  }

  const updateBounds = () => {
    const rect = viewContainer.getBoundingClientRect();
    window.electronAPI.send('view:set-bounds', w.id, {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    });
  };

  function makeNavBtn(kind: 'back' | 'forward' | 'reload' | 'stop', label: string, title: string, handler: () => void) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.className = 'muon-nav-btn';
    btn.dataset.nav = kind;
    btn.onclick = (e) => { e.stopPropagation(); handler(); };
    return btn;
  }

  const icons = layout.nav.icons;
  const titles = layout.nav.titles;
  backBtn = makeNavBtn('back', icons.back, titles.back, () => window.electronAPI.send('view:back', w.id));
  fwdBtn = makeNavBtn('forward', icons.forward, titles.forward, () => window.electronAPI.send('view:forward', w.id));
  reloadBtn = makeNavBtn('reload', icons.reload, titles.reload, () => window.electronAPI.send('view:reload', w.id));
  stopBtn = makeNavBtn('stop', icons.stop, titles.stop, () => window.electronAPI.send('view:stop', w.id));

  topBar.insertBefore(stopBtn, topBar.firstChild);
  topBar.insertBefore(reloadBtn, topBar.firstChild);
  topBar.insertBefore(fwdBtn, topBar.firstChild);
  topBar.insertBefore(backBtn, topBar.firstChild);

  urlBar.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      let val = urlBar.value.trim();
      if (val.startsWith('.')) {
        const note = sanitizeNotePath(val.slice(1));
        urlBar.value = '.' + note.replace(/\.md$/, '');
        w.notePath = note;
        w.url = '';
        w.title = note.split('/').pop()!.replace(/\.md$/, '');
        window.electronAPI.send('view:destroy', w.id);
        setupNoteEditor(viewContainer, note);
        save();
        return;
      }
      if (!/^(https?:|file:)/i.test(val)) {
        if (/^[\w-]+\.[\w-]+/.test(val)) {
          val = 'https://' + val;
        } else {
          val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
        }
      }
      if (w.notePath) {
        w.notePath = undefined;
        viewContainer.innerHTML = '';
        window.electronAPI.send('view:create', w.id, val);
      } else {
        window.electronAPI.send('view:load-url', w.id, val);
      }
      w.url = val;
      w.title = val ? '' : 'Blank';
      save();
    }
  });

  const updateTitle = (title: string) => { w.title = title; };

  if (!w.notePath) {
    subscriptions.push(window.electronAPI.receive(`view:did-navigate:${w.id}`, (url: string) => {
      urlBar.value = url;
      w.url = url;
    }));
    subscriptions.push(window.electronAPI.receive(`view:did-navigate-in-page:${w.id}`, (url: string) => {
      urlBar.value = url;
      w.url = url;
    }));
    subscriptions.push(window.electronAPI.receive(`view:page-title-updated:${w.id}`, (title: string) => {
      updateTitle(title);
    }));
  }

  const adjustZoom = () => {
    if (!w.notePath) {
      const newZoom = transform.scale * (cont.offsetWidth / 800);
      window.electronAPI.send('view:set-zoom-factor', w.id, newZoom);
    }
  };

  const boundsObserver = new ResizeObserver(updateBounds);
  const zoomObserver = new ResizeObserver(adjustZoom);
  boundsObserver.observe(cont);
  zoomObserver.observe(cont);
  resizeObservers.push(boundsObserver, zoomObserver);

  cont.appendChild(topBar);
  cont.appendChild(barContainer);
  cont.appendChild(viewContainer);


  const setActiveWindow = () => {
    muonActiveWindow = cont;
  };

  cont.addEventListener('mousedown', setActiveWindow);
  topBar.addEventListener('mousedown', setActiveWindow);
  barContainer.addEventListener('mousedown', setActiveWindow);
  urlBar.addEventListener('mousedown', setActiveWindow);

  window.electronAPI.receive(`view:did-finish-load:${w.id}`, () => {
    // placeholder for focus logic in main process
  });

  addResizeHandle(cont, w, transform.scale, windows, save, updateBounds);

  if (urlBar) {
    addAddressBarDrag(urlBar, cont, w, transform.scale, windows, save, updateBounds);
  }

  desk.appendChild(cont);

  if (focusBar) urlBar.focus();

  windowCleanups.set(w.id, () => {
    subscriptions.forEach(unsub => unsub());
    resizeObservers.forEach(obs => obs.disconnect());
  });

  return cont;
}

function rebuild () {
  windowCleanups.forEach(clean => clean());
  windowCleanups.clear();
  desk.innerHTML = '';
  windowElements.clear();
  windows.forEach((w, index) => {
    const cont = createWindowElement(w, false);
    if (index === 0 && !muonActiveWindow) {
      muonActiveWindow = cont;
    }
  });
  apply();
}

let dragStartX = 0;
let dragStartY = 0;

function applyLayoutFromConfig() {
  applyWindowLayoutVars(document.documentElement, getWindowLayout());
}

function refreshWindowsFromLayout() {
  const layout = getWindowLayout();
  let changed = false;
  windowElements.forEach((cont, id) => {
    const winData = windows.find(w => w.id === id);
    if (!winData) return;

    const width = Math.max(winData.w, layout.minWindow.width);
    const height = Math.max(winData.h, layout.minWindow.height);
    if (width !== winData.w || height !== winData.h) {
      winData.w = width;
      winData.h = height;
      changed = true;
    }
    cont.style.width = width + 'px';
    cont.style.height = height + 'px';

    const removeBtn = cont.querySelector<HTMLButtonElement>('.muon-remove');
    if (removeBtn) {
      removeBtn.textContent = layout.removeButton.label;
      removeBtn.title = layout.removeButton.title;
    }

    const navButtons = cont.querySelectorAll<HTMLButtonElement>('.muon-nav-btn');
    navButtons.forEach(btn => {
      const key = btn.dataset.nav as 'back' | 'forward' | 'reload' | 'stop' | undefined;
      if (!key) return;
      btn.textContent = layout.nav.icons[key];
      btn.title = layout.nav.titles[key];
    });

    const viewContainer = cont.querySelector<HTMLElement>('.muon-view-container');
    if (viewContainer) {
      const rect = viewContainer.getBoundingClientRect();
      window.electronAPI.send('view:set-bounds', id, {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    }
  });

  if (changed) save();
}

root.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (
    target.closest('.muon-window') ||
    target.closest('.muon-urlbar') ||
    target.closest('.muon-resize-handle')
  ) {
    return;
  }
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const ghost = document.createElement('div');
  ghost.id = 'ghost';
  ghost.className = 'absolute bg-gray-500/10';
  desk.appendChild(ghost);

  const updateGhost = (ev: MouseEvent) => {
    const deskRect = root.getBoundingClientRect();
    const sx = (dragStartX - deskRect.left - transform.offsetX) / transform.scale;
    const sy = (dragStartY - deskRect.top - transform.offsetY) / transform.scale;
    const cx = (ev.clientX - deskRect.left - transform.offsetX) / transform.scale;
    const cy = (ev.clientY - deskRect.top - transform.offsetY) / transform.scale;
    const rect = clampDrag(sx, sy, cx, cy, windows);
    ghost.style.left = rect.x + 'px';
    ghost.style.top = rect.y + 'px';
    ghost.style.width = rect.w + 'px';
    ghost.style.height = rect.h + 'px';
  };

  const move = (ev: MouseEvent) => updateGhost(ev);
    const up = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      updateGhost(ev);
      const gw = parseFloat(ghost.style.width);
      const gh = parseFloat(ghost.style.height);
      const minWindow = getWindowLayout().minWindow;
      if (gw > 32 && gh > 32) {
        const startRect: Rect = {
          x: parseFloat(ghost.style.left),
          y: parseFloat(ghost.style.top),
          w: gw,
          h: gh
        };
        const wdata: WindowData = {
          id: crypto.randomUUID(),
          x: startRect.x,
          y: startRect.y,
          w: Math.max(gw, minWindow.width),
          h: Math.max(gh, minWindow.height),
          url: '',
          title: 'Blank'
        };
      if (!collides(wdata, windows)) {
        windows.push(wdata);
        const el = createWindowElement(wdata, true);
        muonActiveWindow = el;
        save();
      }
    }
    ghost.remove();
  };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
});

function save() {
  saveState(windows, { scale: transform.scale, x: transform.offsetX, y: transform.offsetY });
}

(async () => {
  await loadConfig();
  applyLayoutFromConfig();
  applyGridStyle(root);
  const state: DesktopState = await loadState();
  windows = [];
  const minWindow = getWindowLayout().minWindow;
  for (const w of state.windows) {
    const expanded = {
      ...w,
      w: Math.max(w.w, minWindow.width),
      h: Math.max(w.h, minWindow.height)
    };
    const adjusted = clampMove(expanded, w, windows);
    windows.push({ ...expanded, x: adjusted.x, y: adjusted.y });
  }
  transform.scale = state.transform.scale;
  transform.offsetX = state.transform.x;
  transform.offsetY = state.transform.y;
  rebuild();
  refreshWindowsFromLayout();
})();
