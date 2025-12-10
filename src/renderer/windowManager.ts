// Types for window data and transform
export interface WindowData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  notePath?: string;
  title?: string;
}

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

import { Rect, clampResize, clampMove } from './collision';
import { getWindowLayout } from './settings/appConfig';

interface ResizeState {
  startWidth: number;
  startHeight: number;
  startLeft: number;
  startTop: number;
}

// Add resize handle to all windows
type SnapFn = (rect: Rect) => Rect;

export function addResizeHandle(
  cont: HTMLElement,
  w: WindowData,
  getScale: () => number,
  snapRectFn: SnapFn,
  windows: WindowData[],
  save: () => void,
  updateBounds: () => void
  ) {
  const currentLayout = () => getWindowLayout();

  function makeHandle(
    edge: string,
    cursor: string,
    style: Partial<CSSStyleDeclaration>,
    resizeFn: (dx: number, dy: number, state: ResizeState) => void
  ) {
    const handle = document.createElement('div');
    handle.className = 'muon-resize-handle muon-resize-' + edge + (edge.startsWith('corner') ? ' muon-resize-corner' : '');
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
      let lastRect: Rect = { x: startLeft, y: startTop, w: startWidth, h: startHeight };

      const doResize = (ev: MouseEvent) => {
        const scale = getScale();
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        resizeFn(dx, dy, { startWidth, startHeight, startLeft, startTop });
        const rect = {
          x: parseFloat(cont.style.left),
          y: parseFloat(cont.style.top),
          w: parseFloat(cont.style.width),
          h: parseFloat(cont.style.height)
        } as Rect;
        const clamped = clampResize(rect, lastRect, windows, w.id);
        const snapped = snapRectFn(clamped);
        cont.style.left = snapped.x + 'px';
        cont.style.top = snapped.y + 'px';
        cont.style.width = snapped.w + 'px';
        cont.style.height = snapped.h + 'px';
        lastRect = snapped;
        updateBounds();
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);

        updateBounds();

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

  // Bottom-right corner (se-resize)
  makeHandle(
    'corner-se',
    'nwse-resize',
    {},
    (dx, dy, { startWidth, startHeight }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width, minHeight = minWindow.height;
      const newWidth = Math.max(minWidth, startWidth + dx);
      const newHeight = Math.max(minHeight, startHeight + dy);
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Top-left corner (nw-resize)
  makeHandle(
    'corner-nw',
    'nwse-resize',
    {},
    (dx, dy, { startWidth, startHeight, startLeft, startTop }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width, minHeight = minWindow.height;
      let newWidth = Math.max(minWidth, startWidth - dx);
      let newHeight = Math.max(minHeight, startHeight - dy);
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      if (newWidth === minWidth) newLeft = startLeft + (startWidth - minWidth);
      if (newHeight === minHeight) newTop = startTop + (startHeight - minHeight);
      cont.style.left = newLeft + 'px';
      cont.style.top = newTop + 'px';
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Top-right corner (ne-resize)
  makeHandle(
    'corner-ne',
    'nesw-resize',
    {},
    (dx, dy, { startWidth, startHeight, startTop }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width, minHeight = minWindow.height;
      const newWidth = Math.max(minWidth, startWidth + dx);
      let newHeight = Math.max(minHeight, startHeight - dy);
      let newTop = startTop + dy;
      if (newHeight === minHeight) newTop = startTop + (startHeight - minHeight);
      cont.style.top = newTop + 'px';
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Bottom-left corner (sw-resize)
  makeHandle(
    'corner-sw',
    'nesw-resize',
    {},
    (dx, dy, { startWidth, startHeight, startLeft }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width, minHeight = minWindow.height;
      let newWidth = Math.max(minWidth, startWidth - dx);
      const newHeight = Math.max(minHeight, startHeight + dy);
      let newLeft = startLeft + dx;
      if (newWidth === minWidth) newLeft = startLeft + (startWidth - minWidth);
      cont.style.left = newLeft + 'px';
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  makeHandle(
    'right',
    'ew-resize',
    { right: '0' },
    (dx, _, { startWidth }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width;
      const newWidth = Math.max(minWidth, startWidth + dx);
      cont.style.width = newWidth + 'px';
    }
  );
  makeHandle(
    'bottom',
    'ns-resize',
    { bottom: '0' },
    (_, dy, { startHeight }) => {
      const { minWindow } = currentLayout();
      const minHeight = minWindow.height;
      const newHeight = Math.max(minHeight, startHeight + dy);
      cont.style.height = newHeight + 'px';
    }
  );
  makeHandle(
    'left',
    'ew-resize',
    { left: '0' },
    (dx, _, { startWidth, startLeft }) => {
      const { minWindow } = currentLayout();
      const minWidth = minWindow.width;
      let newWidth = startWidth - dx;
      let newLeft = startLeft + dx;
      if (newWidth < minWidth) {
        newLeft = startLeft + (startWidth - minWidth);
        newWidth = minWidth;
      }
      cont.style.left = newLeft + 'px';
      cont.style.width = newWidth + 'px';
    }
  );
  makeHandle(
    'top',
    'ns-resize',
    { top: '0' },
    (_, dy, { startHeight, startTop }) => {
      const { minWindow } = currentLayout();
      const minHeight = minWindow.height;
      let newHeight = startHeight - dy;
      let newTop = startTop + dy;
      if (newHeight < minHeight) {
        newTop = startTop + (startHeight - minHeight);
        newHeight = minHeight;
      }
      cont.style.top = newTop + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
}

export function addAddressBarDrag(
  urlBar: HTMLInputElement,
  cont: HTMLElement,
  w: WindowData,
  getScale: () => number,
  snapRectFn: SnapFn,
  windows: WindowData[],
  save: () => void,
  updateBounds: () => void
) {
  let startX: number, startY: number;
  let startLeft: number, startTop: number;

  urlBar.addEventListener('mousedown', (e) => {
    if (e.target !== urlBar) return;

    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(cont.style.left);
    startTop = parseFloat(cont.style.top);

    let lastLeft = startLeft;
    let lastTop = startTop;

    const doDrag = (e: MouseEvent) => {
      const scale = getScale();
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const width = parseFloat(cont.style.width);
      const height = parseFloat(cont.style.height);
      const rect = clampMove(
        { x: startLeft + dx, y: startTop + dy, w: width, h: height },
        { x: lastLeft, y: lastTop, w: width, h: height },
        windows,
        w.id
      );
      const snapped = snapRectFn(rect);
      cont.style.left = snapped.x + 'px';
      cont.style.top = snapped.y + 'px';
      lastLeft = snapped.x;
      lastTop = snapped.y;
      updateBounds();
    };

    const stopDrag = (e: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      updateBounds();

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
