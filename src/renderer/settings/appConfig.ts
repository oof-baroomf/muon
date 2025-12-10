import { WindowLayoutConfig, defaultWindowLayout, normalizeWindowLayout } from '../../shared/windowLayout';

export interface WindowSize {
  width: number;
  height: number;
}

export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'dots';
  gridOpacity: number;
  pixelSnap: boolean;
  gridSnap: boolean;
  shortcuts: {
    toggleSearch: string;
    saveState: string;
    centerWindow: string;
  };
  windowLayout: WindowLayoutConfig;
  mainWindow: WindowSize;
  settingsWindow: WindowSize;
}

const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
const isMac = /Mac/.test(platform);
const modKey = isMac ? 'Cmd' : 'Ctrl';
const defaultShortcuts = {
  toggleSearch: `${modKey}+K`,
  saveState: `${modKey}+S`,
  centerWindow: `${modKey}+D`
};

let config: AppConfig = {
  gridSize: 32,
  gridStyle: 'lines',
  gridOpacity: 0.15,
  pixelSnap: true,
  gridSnap: true,
  shortcuts: { ...defaultShortcuts },
  windowLayout: normalizeWindowLayout(defaultWindowLayout),
  mainWindow: { width: 1400, height: 900 },
  settingsWindow: { width: 400, height: 260 }
};

function normalizeWindowSize(size: Partial<WindowSize> | undefined, fallback: WindowSize): WindowSize {
  return {
    width: typeof size?.width === 'number' ? size.width : fallback.width,
    height: typeof size?.height === 'number' ? size.height : fallback.height
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const c = await window.electronAPI.loadConfig();
  config = {
    gridSize: typeof c.gridSize === 'number' ? c.gridSize : 32,
    gridStyle: c.gridStyle === 'dots' ? 'dots' : 'lines',
    gridOpacity: typeof c.gridOpacity === 'number' ? c.gridOpacity : 0.15,
    pixelSnap: typeof c.pixelSnap === 'boolean' ? c.pixelSnap : true,
    gridSnap: typeof c.gridSnap === 'boolean' ? c.gridSnap : true,
    shortcuts: {
      toggleSearch: c.shortcuts?.toggleSearch || defaultShortcuts.toggleSearch,
      saveState: c.shortcuts?.saveState || defaultShortcuts.saveState,
      centerWindow: c.shortcuts?.centerWindow || defaultShortcuts.centerWindow
    },
    windowLayout: normalizeWindowLayout(c.windowLayout),
    mainWindow: normalizeWindowSize(c.mainWindow, config.mainWindow),
    settingsWindow: normalizeWindowSize(c.settingsWindow, config.settingsWindow)
  };
  return config;
}

export function getConfig(): AppConfig {
  return config;
}

export function getWindowLayout(): WindowLayoutConfig {
  return config.windowLayout;
}

export function applyWindowLayoutVars(
  target: HTMLElement = document.documentElement,
  layout: WindowLayoutConfig = config.windowLayout
) {
  const set = (key: string, value: number) => target.style.setProperty(key, `${value}px`);

  set('--muon-bar-height', layout.barHeight);
  set('--muon-view-padding', layout.viewPadding);

  set('--muon-nav-btn-size', layout.nav.buttonSize);
  set('--muon-nav-btn-font-size', layout.nav.fontSize);
  set('--muon-nav-gap', layout.nav.gap);
  set('--muon-nav-margin-left', layout.nav.marginLeft);

  set('--muon-urlbar-font-size', layout.urlBar.fontSize);
  set('--muon-urlbar-height-inset', layout.urlBar.heightInset);
  set('--muon-urlbar-margin-right', layout.urlBar.marginRight);

  set('--muon-remove-size', layout.removeButton.size);
  set('--muon-remove-margin-right', layout.removeButton.marginRight);

  set('--muon-resize-corner', layout.resizeHandles.corner);
  set('--muon-resize-edge', layout.resizeHandles.edge);
  set('--muon-resize-inset', layout.resizeHandles.inset);
}
