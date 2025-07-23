export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'cross' | 'dots';
  gridOpacity: number;
  shortcuts: {
    toggleSearch: string;
    saveState: string;
    centerWindow: string;
  };
}

const isMac = process.platform === 'darwin';
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
  shortcuts: { ...defaultShortcuts }
};

export async function loadConfig(): Promise<AppConfig> {
  const c = await window.electronAPI.loadConfig();
  config = {
    gridSize: typeof c.gridSize === 'number' ? c.gridSize : 32,
    gridStyle: c.gridStyle || 'lines',
    gridOpacity: typeof c.gridOpacity === 'number' ? c.gridOpacity : 0.15,
    shortcuts: {
      toggleSearch: c.shortcuts?.toggleSearch || defaultShortcuts.toggleSearch,
      saveState: c.shortcuts?.saveState || defaultShortcuts.saveState,
      centerWindow: c.shortcuts?.centerWindow || defaultShortcuts.centerWindow
    }
  };
  return config;
}

export function getConfig(): AppConfig {
  return config;
}

export function saveConfig(c: AppConfig) {
  config = c;
  window.electronAPI.saveConfig(config);
}

export function setConfig(c: AppConfig) {
  config = c;
}

