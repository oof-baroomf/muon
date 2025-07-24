import { WindowData, addResizeHandle, addAddressBarDrag } from './windowManager';
import { TransformState, zoomAndCenterWindow, centerWindow } from './desktopTransform';
import { sanitizeNotePath, setupNoteEditor } from './notes';
import { clampMove } from './collision';

export interface WindowElementDeps {
  root: HTMLElement;
  desk: HTMLElement;
  windows: WindowData[];
  windowElements: Map<string, HTMLElement>;
  transform: TransformState;
  applyTransform: () => void;
  save: () => void;
  setActiveWindow: (el: HTMLElement) => void;
}

export function createWindowElement(
  w: WindowData,
  deps: WindowElementDeps,
  focusBar = false
): HTMLElement {
  const { root, desk, windows, windowElements, transform, applyTransform, save, setActiveWindow } = deps;

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
  cont.style.zIndex = '1';

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

  topBar.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomAndCenterWindow(cont, root, transform, applyTransform);
  });

  const navControls = document.createElement('div');
  navControls.className = 'muon-nav-controls';
  navControls.style.display = 'flex';
  navControls.style.alignItems = 'center';
  navControls.style.gap = '2px';
  navControls.style.marginLeft = '4px';

  let backBtn: HTMLButtonElement, fwdBtn: HTMLButtonElement, reloadBtn: HTMLButtonElement, stopBtn: HTMLButtonElement;

  const dragArea = document.createElement('div');
  dragArea.className = 'muon-drag-area';
  dragArea.style.flex = '1 1 0%';
  dragArea.style.height = `${barHeight}px`;
  dragArea.style.cursor = 'grab';
  dragArea.style.userSelect = 'none';
  dragArea.style.background = 'transparent';

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
  removeBtn.textContent = '\u00d7';
  removeBtn.title = 'Remove window';
  removeBtn.className = 'muon-remove';
  removeBtn.style.zIndex = '4';
  removeBtn.onclick = (e) => {
    e.stopPropagation();
    const idx = windows.findIndex(win => win.id === w.id);
    if (idx !== -1) windows.splice(idx, 1);
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
  barContainer.style.position = 'absolute';
  barContainer.style.top = `${barHeight}px`;
  barContainer.style.left = '0';
  barContainer.style.right = '0';
  barContainer.style.height = `${barHeight}px`;
  barContainer.style.display = 'flex';
  barContainer.style.alignItems = 'center';
  barContainer.style.zIndex = '2';
  barContainer.style.background = '#23232a';

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
  urlBar.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zoomAndCenterWindow(cont, root, transform, applyTransform);
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
  viewContainer.style.left = '8px';
  viewContainer.style.right = '8px';
  viewContainer.style.top = `${barHeight * 2}px`;
  viewContainer.style.bottom = '8px';
  viewContainer.style.zIndex = '0';

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

  function makeNavBtn(label: string, title: string, handler: () => void) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.className = 'muon-nav-btn';
    btn.onclick = (e) => { e.stopPropagation(); handler(); };
    return btn;
  }

  backBtn = makeNavBtn('\u2190', 'Back', () => window.electronAPI.send('view:back', w.id));
  fwdBtn = makeNavBtn('\u2192', 'Forward', () => window.electronAPI.send('view:forward', w.id));
  reloadBtn = makeNavBtn('\u27F3', 'Reload', () => window.electronAPI.send('view:reload', w.id));
  stopBtn = makeNavBtn('\u2A09', 'Stop', () => window.electronAPI.send('view:stop', w.id));

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
      save();
    }
  });

  const updateTitle = (title: string) => { w.title = title; };

  if (!w.notePath) {
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
  }

  const adjustZoom = () => {
    if (!w.notePath) {
      const newZoom = transform.scale * (cont.offsetWidth / 800);
      window.electronAPI.send('view:set-zoom-factor', w.id, newZoom);
    }
  };

  new ResizeObserver(updateBounds).observe(cont);
  new ResizeObserver(adjustZoom).observe(cont);

  cont.appendChild(topBar);
  cont.appendChild(barContainer);
  cont.appendChild(viewContainer);

  cont.addEventListener('dblclick', e => {
    if ((e.target as HTMLElement).closest('.muon-urlbar') ||
        (e.target as HTMLElement).closest('.muon-resize-handle')) return;
    e.stopPropagation();
    centerWindow(cont, root, transform, applyTransform);
  });

  const active = () => setActiveWindow(cont);

  cont.addEventListener('mousedown', active);
  topBar.addEventListener('mousedown', active);
  barContainer.addEventListener('mousedown', active);
  urlBar.addEventListener('mousedown', active);

  window.electronAPI.receive(`view:did-finish-load:${w.id}`, () => {
    // placeholder for focus logic in main process
  });

  addResizeHandle(cont, w, transform.scale, windows, save, updateBounds);

  if (urlBar) {
    addAddressBarDrag(urlBar, cont, w, transform.scale, windows, save, updateBounds);
  }

  desk.appendChild(cont);

  if (focusBar) urlBar.focus();

  return cont;
}
