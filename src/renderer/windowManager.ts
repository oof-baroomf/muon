// Types for window data and transform
export interface WindowData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  title?: string;
  viewId?: number;
}

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

// Add resize handle to all windows
export function addResizeHandle(
  cont: HTMLElement,
  w: WindowData,
  scale: number,
  windows: WindowData[],
  save: () => void,
  updateBounds: () => void
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
    { right: '0', bottom: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight }) => {
      const minWidth = 200, minHeight = 200;
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
    { left: '0', top: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startLeft, startTop }) => {
      const minWidth = 200, minHeight = 200;
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
    { right: '0', top: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startTop }) => {
      const minWidth = 200, minHeight = 200;
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
    { left: '0', bottom: '0', width: '12px', height: '12px', background: 'transparent' },
    (dx, dy, { startWidth, startHeight, startLeft }) => {
      const minWidth = 200, minHeight = 200;
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
    { right: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth }) => {
      const minWidth = 200;
      const newWidth = Math.max(minWidth, startWidth + dx);
      cont.style.width = newWidth + 'px';
    }
  );
  makeHandle(
    'bottom',
    'ns-resize',
    { left: '12px', right: '12px', bottom: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight }) => {
      const minHeight = 200;
      const newHeight = Math.max(minHeight, startHeight + dy);
      cont.style.height = newHeight + 'px';
    }
  );
  makeHandle(
    'left',
    'ew-resize',
    { left: '0', top: '12px', width: '8px', bottom: '12px', background: 'transparent' },
    (dx, _, { startWidth, startLeft }) => {
      const minWidth = 200;
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
    { left: '12px', right: '12px', top: '0', height: '8px', background: 'transparent' },
    (_, dy, { startHeight, startTop }) => {
      const minHeight = 200;
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
  scale: number,
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

    const doDrag = (e: MouseEvent) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      cont.style.left = (startLeft + dx) + 'px';
      cont.style.top = (startTop + dy) + 'px';
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
