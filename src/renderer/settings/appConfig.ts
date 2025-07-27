export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'dots';
  gridOpacity: number;
  shortcuts: {
    toggleSearch: string;
    saveState: string;
    centerWindow: string;
    reloadWindow: string;
    hardReloadWindow: string;
    newWindow: string;
    openSettings: string;
    goBack: string;
    goForward: string;
    zoomInSite: string;
    zoomOutSite: string;
    zoomInUI: string;
    zoomOutUI: string;
  };
}

const platform = typeof navigator !== 'undefined' ? navigator.platform : '';
const isMac = /Mac/.test(platform);
const modKey = isMac ? 'Cmd' : 'Ctrl';
const defaultShortcuts = {
  toggleSearch: `${modKey}+K`,
  saveState: `${modKey}+S`,
  centerWindow: `${modKey}+D`,
  reloadWindow: `${modKey}+R`,
  hardReloadWindow: `${modKey}+Shift+R`,
  newWindow: `${modKey}+T`,
  openSettings: `${modKey}+,`,
  goBack: `${modKey}+[`,
  goForward: `${modKey}+]`,
  zoomInSite: `${modKey}+=`,
  zoomOutSite: `${modKey}+-`,
  zoomInUI: `Alt+=`,
  zoomOutUI: `Alt+-`
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
    gridStyle: c.gridStyle === 'dots' ? 'dots' : 'lines',
    gridOpacity: typeof c.gridOpacity === 'number' ? c.gridOpacity : 0.15,
    shortcuts: {
      toggleSearch: c.shortcuts?.toggleSearch || defaultShortcuts.toggleSearch,
      saveState: c.shortcuts?.saveState || defaultShortcuts.saveState,
      centerWindow: c.shortcuts?.centerWindow || defaultShortcuts.centerWindow,
      reloadWindow: c.shortcuts?.reloadWindow || defaultShortcuts.reloadWindow,
      hardReloadWindow: c.shortcuts?.hardReloadWindow || defaultShortcuts.hardReloadWindow,
      newWindow: c.shortcuts?.newWindow || defaultShortcuts.newWindow,
      openSettings: c.shortcuts?.openSettings || defaultShortcuts.openSettings,
      goBack: c.shortcuts?.goBack || defaultShortcuts.goBack,
      goForward: c.shortcuts?.goForward || defaultShortcuts.goForward,
      zoomInSite: c.shortcuts?.zoomInSite || defaultShortcuts.zoomInSite,
      zoomOutSite: c.shortcuts?.zoomOutSite || defaultShortcuts.zoomOutSite,
      zoomInUI: c.shortcuts?.zoomInUI || defaultShortcuts.zoomInUI,
      zoomOutUI: c.shortcuts?.zoomOutUI || defaultShortcuts.zoomOutUI
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

