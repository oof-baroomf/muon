export interface TransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface ZoomState {
  zoomed: boolean;
  origScale: number;
  origOffsetX: number;
  origOffsetY: number;
}

const zoomStateMap = new WeakMap<HTMLElement, ZoomState>();

let uiRerenderTimeout: NodeJS.Timeout | null = null;

import { WindowData } from './windowManager';
import { getConfig } from './settings/appConfig';
import { updateNoteEditorZoom } from './notes';

export function updateAllWindowsBounds(
  windows: WindowData[],
  windowElements: Map<string, HTMLElement>
) {
  for (const w of windows) {
    const cont = windowElements.get(w.id);
    if (cont) {
      const viewContainer = cont.querySelector('.muon-view-container') as HTMLElement;
      if (viewContainer) {
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

export function updateAllWindowsZoom(
  windows: WindowData[],
  windowElements: Map<string, HTMLElement>,
  scale: number
) {
  for (const w of windows) {
    const cont = windowElements.get(w.id);
    if (cont) {
      const newZoom = scale * (cont.offsetWidth / 800);
      window.electronAPI.send('view:set-zoom-factor', w.id, newZoom);
    }
  }
}

function debouncedUIRerender(root: HTMLElement, desk: HTMLElement, scale: number) {
  if (uiRerenderTimeout) {
    clearTimeout(uiRerenderTimeout);
  }
  uiRerenderTimeout = setTimeout(() => {
    forceUIRerender(root, desk, scale);
    uiRerenderTimeout = null;
  }, 150);
}

function forceUIRerender(root: HTMLElement, desk: HTMLElement, scale: number) {
  console.log('Force UI rerender called, scale:', scale);
  const allUIElements = document.querySelectorAll(
    '.muon-topbar-container, .muon-urlbar-container, .muon-nav-btn, .muon-urlbar, .muon-remove, .muon-drag-area, .muon-nav-controls'
  );
  allUIElements.forEach((element: Element) => {
    const htmlElement = element as HTMLElement;
    const originalDisplay = htmlElement.style.display;
    htmlElement.style.display = 'none';
    htmlElement.offsetHeight;
    htmlElement.style.display = originalDisplay;

    const originalOpacity = htmlElement.style.opacity;
    htmlElement.style.opacity = '0.999';
    htmlElement.offsetHeight;
    htmlElement.style.opacity = originalOpacity || '';

    const originalTransform = htmlElement.style.transform;
    htmlElement.style.transform = 'translateZ(0.1px)';
    htmlElement.offsetHeight;
    htmlElement.style.transform = originalTransform || '';

    if (
      htmlElement.tagName === 'BUTTON' ||
      htmlElement.tagName === 'INPUT' ||
      htmlElement.textContent
    ) {
      const computedStyle = window.getComputedStyle(htmlElement);
      const fontSize = parseFloat(computedStyle.fontSize);
      if (fontSize) {
        const originalFontSize = htmlElement.style.fontSize;
        htmlElement.style.fontSize = fontSize + 0.001 + 'px';
        htmlElement.offsetHeight;
        htmlElement.style.fontSize = originalFontSize || '';
      }
    }
  });

  const originalZoom = desk.style.zoom;
  desk.style.zoom = (1.0001).toString();
  desk.offsetHeight;
  desk.style.zoom = originalZoom || '';
  console.log('UI rerender completed');
}

export function applyTransform(
  desk: HTMLElement,
  root: HTMLElement,
  windows: WindowData[],
  windowElements: Map<string, HTMLElement>,
  state: TransformState
) {
  desk.style.transform = `translate(${state.offsetX}px,${state.offsetY}px) scale(${state.scale})`;
  const base = getConfig().gridSize;
  const gridSize = base * state.scale;
  root.style.backgroundSize = `${gridSize}px ${gridSize}px`;
  root.style.backgroundPosition = `${state.offsetX}px ${state.offsetY}px`;
  updateAllWindowsBounds(windows, windowElements);
  updateAllWindowsZoom(windows, windowElements, state.scale);
  updateNoteEditorZoom(state.scale);
  root.style.backgroundRepeat = 'repeat';
  root.offsetHeight;
  debouncedUIRerender(root, desk, state.scale);
}

export function zoomAndCenterWindow(
  cont: HTMLElement,
  root: HTMLElement,
  state: TransformState,
  apply: () => void
) {
  let zs = zoomStateMap.get(cont);
  if (!zs) {
    zs = { zoomed: false, origScale: state.scale, origOffsetX: state.offsetX, origOffsetY: state.offsetY };
    zoomStateMap.set(cont, zs);
  }

  if (zs.zoomed) {
    const targetScale = zs.origScale;
    const targetOffsetX = zs.origOffsetX;
    const targetOffsetY = zs.origOffsetY;
    const startScale = state.scale;
    const startOffsetX = state.offsetX;
    const startOffsetY = state.offsetY;
    const duration = 300;
    const startTime = performance.now();

    function animateRestore(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      state.scale = startScale + (targetScale - startScale) * ease;
      state.offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
      state.offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease;
      apply();
      if (t < 1) {
        requestAnimationFrame(animateRestore);
      } else {
        state.scale = targetScale;
        state.offsetX = targetOffsetX;
        state.offsetY = targetOffsetY;
        apply();
      }
    }
    requestAnimationFrame(animateRestore);
    zs.zoomed = false;
    return;
  }

  zs.origScale = state.scale;
  zs.origOffsetX = state.offsetX;
  zs.origOffsetY = state.offsetY;

  const margin = 32;
  const winW = cont.offsetWidth;
  const winH = cont.offsetHeight;
  const winX = parseFloat(cont.style.left);
  const winY = parseFloat(cont.style.top);

  const viewportW = root.clientWidth;
  const viewportH = root.clientHeight;

  const scaleX = (viewportW - 2 * margin) / winW;
  const scaleY = (viewportH - 2 * margin) / winH;
  const targetScale = Math.min(scaleX, scaleY, 4);

  const winCenterX = winX + winW / 2;
  const winCenterY = winY + winH / 2;
  const viewportCenterX = viewportW / 2;
  const viewportCenterY = viewportH / 2;

  const targetOffsetX = viewportCenterX - winCenterX * targetScale;
  const targetOffsetY = viewportCenterY - winCenterY * targetScale;

  const startScale = state.scale;
  const startOffsetX = state.offsetX;
  const startOffsetY = state.offsetY;
  const duration = 300;
  const startTime = performance.now();

  function animateZoom(now: number) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    state.scale = startScale + (targetScale - startScale) * ease;
    state.offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
    state.offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease;
    apply();
    if (t < 1) {
      requestAnimationFrame(animateZoom);
    } else {
      state.scale = targetScale;
      state.offsetX = targetOffsetX;
      state.offsetY = targetOffsetY;
      apply();
    }
  }
  requestAnimationFrame(animateZoom);
  zs.zoomed = true;
}
