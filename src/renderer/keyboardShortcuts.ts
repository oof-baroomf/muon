import { showSearch, hideSearch, isSearchVisible } from './searchOverlay';
import { zoomAndCenterWindow, TransformState } from './desktopTransform';
import { WindowData } from './windowManager';

interface Deps {
  desk: HTMLElement;
  getWindows: () => WindowData[];
  getActiveWindow: () => HTMLElement | null;
  setActiveWindow: (el: HTMLElement | null) => void;
  save: () => void;
  transform: TransformState;
  applyTransform: () => void;
  root: HTMLElement;
}

export function initKeyboardShortcuts(d: Deps) {
  document.addEventListener('keydown', e => {
    console.log('Key event:', e.key, 'meta:', e.metaKey, 'ctrl:', e.ctrlKey);

    if (isSearchVisible()) {
      if (e.key === 'Escape') { hideSearch(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const results = d.getWindows();
        if (results.length) {
          // cycling handled in search overlay
          document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const results = d.getWindows();
        if (results.length) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
        return;
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isSearchVisible()) {
        hideSearch();
      } else {
        showSearch();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      d.save();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      let targetWindow = d.getActiveWindow();
      if (!targetWindow && d.getWindows().length > 0) {
        const first = d.desk.querySelector('.muon-window') as HTMLElement;
        if (first) {
          targetWindow = first;
          d.setActiveWindow(first);
        }
      }
      if (targetWindow) {
        zoomAndCenterWindow(targetWindow, d.root, d.transform, d.applyTransform);
      }
      return;
    }
  });
}
