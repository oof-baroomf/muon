import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import YAML from 'yaml';

export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'dots';
  gridOpacity: number;
  shortcuts: {
    toggleSearch: string;
    saveState: string;
    centerWindow: string;
    reloadWindow: string;
    newWindow: string;
    zoomInSite: string;
    zoomOutSite: string;
    zoomInUI: string;
    zoomOutUI: string;
  };
}

const isMac = process.platform === 'darwin';
const modKey = isMac ? 'Cmd' : 'Ctrl';
const defaultShortcuts = {
  toggleSearch: `${modKey}+K`,
  saveState: `${modKey}+S`,
  centerWindow: `${modKey}+D`,
  reloadWindow: `${modKey}+R`,
  newWindow: `${modKey}+T`,
  zoomInSite: `${modKey}+=`,
  zoomOutSite: `${modKey}+-`,
  zoomInUI: `Alt+=`,
  zoomOutUI: `Alt+-`
};

const configPath = path.join(app.getPath('userData'), 'config.yaml');

const defaultConfig: AppConfig = {
  gridSize: 32,
  gridStyle: 'lines',
  gridOpacity: 0.15,
  shortcuts: { ...defaultShortcuts }
};

export function loadConfig(): AppConfig {
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, YAML.stringify(defaultConfig));
    return { ...defaultConfig };
  }
  try {
    const text = fs.readFileSync(configPath, 'utf-8');
    const cfg = YAML.parse(text) as Partial<AppConfig> | null || {};
    return {
      gridSize: typeof cfg.gridSize === 'number' ? cfg.gridSize : defaultConfig.gridSize,
      gridStyle: cfg.gridStyle === 'dots' ? 'dots' : defaultConfig.gridStyle,
      gridOpacity: typeof cfg.gridOpacity === 'number' ? cfg.gridOpacity : defaultConfig.gridOpacity,
      shortcuts: {
        toggleSearch: cfg.shortcuts?.toggleSearch ?? defaultShortcuts.toggleSearch,
        saveState: cfg.shortcuts?.saveState ?? defaultShortcuts.saveState,
        centerWindow: cfg.shortcuts?.centerWindow ?? defaultShortcuts.centerWindow,
        reloadWindow: cfg.shortcuts?.reloadWindow ?? defaultShortcuts.reloadWindow,
        newWindow: cfg.shortcuts?.newWindow ?? defaultShortcuts.newWindow,
        zoomInSite: cfg.shortcuts?.zoomInSite ?? defaultShortcuts.zoomInSite,
        zoomOutSite: cfg.shortcuts?.zoomOutSite ?? defaultShortcuts.zoomOutSite,
        zoomInUI: cfg.shortcuts?.zoomInUI ?? defaultShortcuts.zoomInUI,
        zoomOutUI: cfg.shortcuts?.zoomOutUI ?? defaultShortcuts.zoomOutUI
      }
    };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: AppConfig) {
  const data = {
    gridSize: config.gridSize,
    gridStyle: config.gridStyle,
    gridOpacity: config.gridOpacity,
    shortcuts: { ...config.shortcuts }
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, YAML.stringify(data));
}
