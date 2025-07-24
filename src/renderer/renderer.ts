import './styles.css';
import { WindowData } from './windowManager';
import { saveState } from './state';
import { TransformState, applyTransform, initPanZoom } from './desktopTransform';
import { initSearchOverlay } from './searchOverlay';
import { initKeyboardShortcuts } from './keyboardShortcuts';
import { createWindowElement } from './windowElement';
import { initWindowCreation } from './windowCreation';
import { bootstrap } from './bootstrap';

const root = document.getElementById('root') as HTMLElement;
root.tabIndex = 0;

const desk = document.createElement('div');
desk.id = 'muon-desktop';
desk.className = 'absolute inset-0 origin-top-left will-change-transform';
root.appendChild(desk);

let windows: WindowData[] = [];
let muonActiveWindow: HTMLElement | null = null;

const windowElements = new Map<string, HTMLElement>();

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

initWindowCreation({
  root,
  desk,
  windows,
  transform,
  apply,
  save,
  createWindow: (w, focus) => createWindowElement(w, {
    root,
    desk,
    windows,
    windowElements,
    transform,
    applyTransform: apply,
    save,
    setActiveWindow: el => { muonActiveWindow = el; }
  }, focus),
  setActiveWindow: el => { muonActiveWindow = el; }
});


function rebuild () {
  desk.innerHTML = '';
  windowElements.clear();
  windows.forEach((w, index) => {
    const cont = createWindowElement(w, {
      root,
      desk,
      windows,
      windowElements,
      transform,
      applyTransform: apply,
      save,
      setActiveWindow: el => { muonActiveWindow = el; }
    }, false);
    if (index === 0 && !muonActiveWindow) {
      muonActiveWindow = cont;
    }
  });
  apply();
}


function save() {
  saveState(windows, { scale: transform.scale, x: transform.offsetX, y: transform.offsetY });
}

bootstrap({
  root,
  windows,
  transform,
  rebuild,
  apply
});

