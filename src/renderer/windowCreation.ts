import { WindowData } from './windowManager';
import { clampDrag } from './collision';
import { TransformState } from './desktopTransform';

export interface WindowCreationDeps {
  root: HTMLElement;
  desk: HTMLElement;
  windows: WindowData[];
  transform: TransformState;
  apply: () => void;
  save: () => void;
  createWindow: (w: WindowData, focus: boolean) => HTMLElement;
  setActiveWindow: (el: HTMLElement) => void;
}

export function initWindowCreation(d: WindowCreationDeps) {
  let dragStartX = 0;
  let dragStartY = 0;
  d.root.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.muon-urlbar') || target.closest('.muon-resize-handle')) {
      return;
    }
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const ghost = document.createElement('div');
    ghost.id = 'ghost';
    ghost.className = 'absolute border border-gray-500 bg-gray-500/10';
    d.desk.appendChild(ghost);

    const updateGhost = (ev: MouseEvent) => {
      const deskRect = d.root.getBoundingClientRect();
      const sx = (dragStartX - deskRect.left - d.transform.offsetX) / d.transform.scale;
      const sy = (dragStartY - deskRect.top - d.transform.offsetY) / d.transform.scale;
      const cx = (ev.clientX - deskRect.left - d.transform.offsetX) / d.transform.scale;
      const cy = (ev.clientY - deskRect.top - d.transform.offsetY) / d.transform.scale;
      const rect = clampDrag(sx, sy, cx, cy, d.windows);
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
      if (gw > 32 && gh > 32) {
        const wdata: WindowData = {
          id: crypto.randomUUID(),
          x: parseFloat(ghost.style.left),
          y: parseFloat(ghost.style.top),
          w: gw,
          h: gh,
          url: ''
        };
        d.windows.push(wdata);
        const el = d.createWindow(wdata, true);
        d.setActiveWindow(el);
        d.save();
      }
      ghost.remove();
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
