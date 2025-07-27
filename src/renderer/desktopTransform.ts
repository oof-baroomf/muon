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
  zoomScale?: number;
  zoomOffsetX?: number;
  zoomOffsetY?: number;
}

const zoomStateMap = new WeakMap<HTMLElement, ZoomState>();
let activeZoomElement: HTMLElement | null = null;

export function panActiveZoom(dx: number, dy: number) {
  if (!activeZoomElement) return;
  const zs = zoomStateMap.get(activeZoomElement);
  if (!zs || !zs.zoomed) return;
  zs.origOffsetX += dx;
  zs.origOffsetY += dy;
}

let uiRerenderTimeout: ReturnType<typeof setTimeout> | null = null;

import { WindowData } from './windowManager';
import { getConfig } from './settings/appConfig';
import { rerenderVisibleNotes } from './notes';

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
  rerenderVisibleNotes();
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
  root.style.backgroundRepeat = 'repeat';
  root.offsetHeight;
  debouncedUIRerender(root, desk, state.scale);
  rerenderVisibleNotes();
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
    const scaleDiff = Math.abs(state.scale - (zs.zoomScale ?? state.scale));
    const dx = state.offsetX - (zs.zoomOffsetX ?? state.offsetX);
    const dy = state.offsetY - (zs.zoomOffsetY ?? state.offsetY);
    const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

    if (scaleDiff < 0.001 && !moved) {
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
      activeZoomElement = null;
      return;
    }

    if (scaleDiff < 0.001 && moved && zs.zoomOffsetX !== undefined && zs.zoomOffsetY !== undefined) {
      const startOffsetX = state.offsetX;
      const startOffsetY = state.offsetY;
      const targetOffsetX = zs.zoomOffsetX;
      const targetOffsetY = zs.zoomOffsetY;
      const duration = 300;
      const startTime = performance.now();

      function animateRecenter(now: number) {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        state.offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease;
        state.offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease;
        apply();
        if (t < 1) {
          requestAnimationFrame(animateRecenter);
        } else {
          state.offsetX = targetOffsetX;
          state.offsetY = targetOffsetY;
          apply();
        }
      }
      requestAnimationFrame(animateRecenter);
      return;
    }

    // scale changed while zoomed; reset zoom state
    zs.zoomed = false;
    activeZoomElement = null;
    zs.origScale = state.scale;
    zs.origOffsetX = state.offsetX;
    zs.origOffsetY = state.offsetY;
  }

  zs.origScale = state.scale;

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

  zs.origOffsetX = state.offsetX;
  zs.origOffsetY = state.offsetY;

  zs.zoomScale = targetScale;
  zs.zoomOffsetX = targetOffsetX;
  zs.zoomOffsetY = targetOffsetY;

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
  activeZoomElement = cont;
}

export function centerWindow(cont: HTMLElement, root: HTMLElement, state: TransformState, apply: () => void) {
  const bounds = cont.getBoundingClientRect();
  const cx = bounds.left + bounds.width / 2 - root.clientWidth / 2;
  const cy = bounds.top + bounds.height / 2 - root.clientHeight / 2;
  const dx = -cx / state.scale;
  const dy = -cy / state.scale;
  state.offsetX += dx;
  state.offsetY += dy;
  panActiveZoom(dx, dy);
  apply();
}

export function initPanZoom(root: HTMLElement, state: TransformState, apply: () => void) {
  root.addEventListener('wheel', e => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLElement).matches(':focus')) {
      return;
    }
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      const zoomIntensity = 0.001;
      const delta = -e.deltaY * zoomIntensity;
      const mx = e.clientX - root.getBoundingClientRect().left;
      const my = e.clientY - root.getBoundingClientRect().top;
      const wx = (mx - state.offsetX) / state.scale;
      const wy = (my - state.offsetY) / state.scale;
      state.scale = Math.min(Math.max(0.25, state.scale * (1 + delta)), 4);
      state.offsetX = mx - wx * state.scale;
      state.offsetY = my - wy * state.scale;
    } else {
      const dx = -e.deltaX / state.scale;
      const dy = -e.deltaY / state.scale;
      state.offsetX += dx;
      state.offsetY += dy;
      panActiveZoom(dx, dy);
    }
    apply();
  }, { passive: false });
}

