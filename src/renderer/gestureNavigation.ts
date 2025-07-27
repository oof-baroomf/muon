export interface GestureDeps {
  root: HTMLElement;
  getActiveWindow: () => HTMLElement | null;
}

export function initGestureNavigation(d: GestureDeps) {
  window.electronAPI.receive('swipe', (dir: string) => {
    const active = d.getActiveWindow();
    if (!active) return;
    const id = active.dataset.id!;
    if (dir === 'left') {
      window.electronAPI.send('view:back', id);
    } else if (dir === 'right') {
      window.electronAPI.send('view:forward', id);
    }
  });

  let accum = 0;
  let last = 0;
  d.root.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const now = Date.now();
    if (now - last > 400) accum = 0;
    accum += e.deltaX;
    last = now;
    if (accum > 200) {
      const active = d.getActiveWindow();
      if (active) window.electronAPI.send('view:forward', active.dataset.id!);
      accum = 0;
    } else if (accum < -200) {
      const active = d.getActiveWindow();
      if (active) window.electronAPI.send('view:back', active.dataset.id!);
      accum = 0;
    }
  }, { passive: true });
}
