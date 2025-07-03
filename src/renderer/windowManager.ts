// Types for window data and transform
export interface WindowData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  viewId?: number;
}

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

export const GRID_SIZE = 32;

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Add resize handle to all windows
export function addResizeHandle(
  cont: HTMLElement,
  w: WindowData,
  scale: number,
  windows: WindowData[],
  save: () => void
) {
  function makeHandle(
    edge: string,
    cursor: string,
    style: Partial<CSSStyleDeclaration>,
    resizeFn: (dx: number, dy: number, state: any) => void
  ) {
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

        // Update webview size only (no zoom on every mousemove)
        const webview = cont.querySelector('webview') as Electron.WebviewTag | null;
        if (webview) {
          const barHeight = 24;
          webview.style.height = `calc(100% - ${barHeight}px)`;
        }
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);

        // Update webview zoom factor once on mouseup for performance
        const webview = cont.querySelector('webview') as Electron.WebviewTag | null;
        if (webview) {
          const newZoom = cont.offsetWidth / 800;
          webview.setZoomFactor(newZoom);
        }

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
    { right: '0', bottom: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight }) => {
      const minWidth = 200, minHeight = 200;
      const newWidth = Math.max(minWidth, snap(startWidth + dx));
      const newHeight = Math.max(minHeight, snap(startHeight + dy));
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Top-left corner (nw-resize)
  makeHandle(
    'corner-nw',
    'nwse-resize',
    { left: '0', top: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startLeft, startTop }) => {
      const minWidth = 200, minHeight = 200;
      const right = startLeft + startWidth;
      const bottom = startTop + startHeight;
      let newLeft = snap(startLeft + dx);
      let newTop = snap(startTop + dy);
      let newWidth = snap(right - newLeft);
      let newHeight = snap(bottom - newTop);
      if (newWidth < minWidth) {
        newWidth = minWidth;
        newLeft = right - minWidth;
      }
      if (newHeight < minHeight) {
        newHeight = minHeight;
        newTop = bottom - minHeight;
      }
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
    { right: '0', top: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startTop }) => {
      const minWidth = 200, minHeight = 200;
      const bottom = startTop + startHeight;
      const newWidth = Math.max(minWidth, snap(startWidth + dx));
      let newTop = snap(startTop + dy);
      let newHeight = snap(bottom - newTop);
      if (newHeight < minHeight) {
        newHeight = minHeight;
        newTop = bottom - minHeight;
      }
      cont.style.top = newTop + 'px';
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  // Bottom-left corner (sw-resize)
  makeHandle(
    'corner-sw',
    'nesw-resize',
    { left: '0', bottom: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startLeft }) => {
      const minWidth = 200, minHeight = 200;
      const right = startLeft + startWidth;
      let newLeft = snap(startLeft + dx);
      let newWidth = snap(right - newLeft);
      if (newWidth < minWidth) {
        newWidth = minWidth;
        newLeft = right - minWidth;
      }
      const newHeight = Math.max(minHeight, snap(startHeight + dy));
      cont.style.left = newLeft + 'px';
      cont.style.width = newWidth + 'px';
      cont.style.height = newHeight + 'px';
    }
  );
  makeHandle(
    'right',
    'ew-resize',
    { right: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth }) => {
      const minWidth = 200;
      const newWidth = Math.max(minWidth, snap(startWidth + dx));
      cont.style.width = newWidth + 'px';
    }
  );
  makeHandle(
    'bottom',
    'ns-resize',
    { left: '12px', right: '12px', bottom: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight }) => {
      const minHeight = 200;
      const newHeight = Math.max(minHeight, snap(startHeight + dy));
      cont.style.height = newHeight + 'px';
    }
  );
  makeHandle(
    'left',
    'ew-resize',
    { left: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth, startLeft }) => {
      const minWidth = 200;
      const right = startLeft + startWidth;
      let newLeft = snap(startLeft + dx);
      let newWidth = snap(right - newLeft);
      if (newWidth < minWidth) {
        newWidth = minWidth;
        newLeft = right - minWidth;
      }
      cont.style.left = newLeft + 'px';
      cont.style.width = newWidth + 'px';
    }
  );
  makeHandle(
    'top',
    'ns-resize',
    { left: '12px', right: '12px', top: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight, startTop }) => {
      const minHeight = 200;
      const bottom = startTop + startHeight;
      let newTop = snap(startTop + dy);
      let newHeight = snap(bottom - newTop);
      if (newHeight < minHeight) {
        newHeight = minHeight;
        newTop = bottom - minHeight;
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
  scale: number,
  windows: WindowData[],
  save: () => void
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

    const doDrag = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      cont.style.left = (startLeft + dx) + 'px';
      cont.style.top = (startTop + dy) + 'px';
    };

    const stopDrag = (e: MouseEvent) => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);

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
