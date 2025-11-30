import { showSearch, hideSearch, isSearchVisible, handleSearchKey } from './searchOverlay';
import { zoomAndCenterWindow, TransformState } from './desktopTransform';
import { WindowData } from './windowManager';
import { getConfig } from './settings/appConfig';

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

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const tokens = shortcut.toLowerCase().split('+');
  const key = tokens.pop();
  const req = { ctrl: false, meta: false, alt: false, shift: false };
  for (const t of tokens) {
    if (t === 'ctrl' || t === 'control') req.ctrl = true;
    else if (t === 'cmd' || t === 'meta') req.meta = true;
    else if (t === 'alt') req.alt = true;
    else if (t === 'shift') req.shift = true;
  }
  return key === e.key.toLowerCase() &&
    (!req.ctrl || e.ctrlKey) &&
    (!req.meta || e.metaKey) &&
    (!req.alt || e.altKey) &&
    (!req.shift || e.shiftKey);
}

export function initKeyboardShortcuts(d: Deps) {
  document.addEventListener('keydown', e => {
    const cfg = getConfig();

    if (isSearchVisible() && handleSearchKey(e)) {
      e.preventDefault();
      return;
    }

    if (matchesShortcut(e, cfg.shortcuts.toggleSearch)) {
      e.preventDefault();
      if (isSearchVisible()) {
        hideSearch();
      } else {
        showSearch();
      }
      return;
    }

    if (matchesShortcut(e, cfg.shortcuts.saveState)) {
      e.preventDefault();
      d.save();
      return;
    }

    if (matchesShortcut(e, cfg.shortcuts.centerWindow)) {
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
