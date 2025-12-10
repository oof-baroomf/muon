import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { parse as parseToml, stringify as stringifyToml, JsonMap } from '@iarna/toml';
import { WindowLayoutConfig, defaultWindowLayout, normalizeWindowLayout } from './shared/windowLayout';

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

export interface WindowSize {
  width: number;
  height: number;
}

const isMac = process.platform === 'darwin';
const modKey = isMac ? 'Cmd' : 'Ctrl';
const defaultShortcuts = {
  toggleSearch: `${modKey}+K`,
  saveState: `${modKey}+S`,
  centerWindow: `${modKey}+D`
};

const configPath = path.join(app.getAppPath(), 'config.toml');

const defaultMainWindow: WindowSize = { width: 1400, height: 900 };
const defaultSettingsWindow: WindowSize = { width: 400, height: 260 };

const defaultConfig: AppConfig = {
  gridSize: 32,
  gridStyle: 'lines',
  gridOpacity: 0.15,
  pixelSnap: true,
  gridSnap: true,
  shortcuts: { ...defaultShortcuts },
  windowLayout: normalizeWindowLayout(defaultWindowLayout),
  mainWindow: { ...defaultMainWindow },
  settingsWindow: { ...defaultSettingsWindow }
};

function normalizeWindowSize(size: Partial<WindowSize> | undefined, fallback: WindowSize): WindowSize {
  return {
    width: typeof size?.width === 'number' ? size.width : fallback.width,
    height: typeof size?.height === 'number' ? size.height : fallback.height
  };
}

function normalizeConfig(cfg: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    gridSize: typeof cfg?.gridSize === 'number' ? cfg.gridSize : defaultConfig.gridSize,
    gridStyle: cfg?.gridStyle === 'dots' ? 'dots' : defaultConfig.gridStyle,
    gridOpacity: typeof cfg?.gridOpacity === 'number' ? cfg.gridOpacity : defaultConfig.gridOpacity,
    pixelSnap: typeof cfg?.pixelSnap === 'boolean' ? cfg.pixelSnap : defaultConfig.pixelSnap,
    gridSnap: typeof cfg?.gridSnap === 'boolean' ? cfg.gridSnap : defaultConfig.gridSnap,
    shortcuts: {
      toggleSearch: cfg?.shortcuts?.toggleSearch ?? defaultShortcuts.toggleSearch,
      saveState: cfg?.shortcuts?.saveState ?? defaultShortcuts.saveState,
      centerWindow: cfg?.shortcuts?.centerWindow ?? defaultShortcuts.centerWindow
    },
    windowLayout: normalizeWindowLayout(cfg?.windowLayout),
    mainWindow: normalizeWindowSize(cfg?.mainWindow, defaultMainWindow),
    settingsWindow: normalizeWindowSize(cfg?.settingsWindow, defaultSettingsWindow)
  };
}

export function loadConfig(): AppConfig {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });

  const readToml = () => {
    const text = fs.readFileSync(configPath, 'utf-8');
    return normalizeConfig(parseToml(text) as Partial<AppConfig>);
  };

  try {
    if (fs.existsSync(configPath)) {
      return readToml();
    }

    saveConfig(defaultConfig);
    return { ...defaultConfig };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: AppConfig) {
  const data: JsonMap = {
    gridSize: config.gridSize,
    gridStyle: config.gridStyle,
    gridOpacity: config.gridOpacity,
    pixelSnap: config.pixelSnap,
    gridSnap: config.gridSnap,
    shortcuts: { ...config.shortcuts },
    windowLayout: JSON.parse(JSON.stringify(config.windowLayout)),
    mainWindow: { ...config.mainWindow },
    settingsWindow: { ...config.settingsWindow }
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const toml = stringifyToml(data);
  fs.writeFileSync(configPath, toml);
}

export function getConfigPath(): string {
  return configPath;
}
