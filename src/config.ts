import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { parse as parseToml, stringify as stringifyToml, JsonMap } from '@iarna/toml';
import { WindowLayoutConfig, defaultWindowLayout, normalizeWindowLayout } from './shared/windowLayout';

export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'dots';
  gridOpacity: number;
  shortcuts: {
    toggleSearch: string;
    saveState: string;
    centerWindow: string;
  };
  windowLayout: WindowLayoutConfig;
}

const isMac = process.platform === 'darwin';
const modKey = isMac ? 'Cmd' : 'Ctrl';
const defaultShortcuts = {
  toggleSearch: `${modKey}+K`,
  saveState: `${modKey}+S`,
  centerWindow: `${modKey}+D`
};

const configPath = path.join(app.getAppPath(), 'config.toml');

const defaultConfig: AppConfig = {
  gridSize: 32,
  gridStyle: 'lines',
  gridOpacity: 0.15,
  shortcuts: { ...defaultShortcuts },
  windowLayout: normalizeWindowLayout(defaultWindowLayout)
};

function normalizeConfig(cfg: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    gridSize: typeof cfg?.gridSize === 'number' ? cfg.gridSize : defaultConfig.gridSize,
    gridStyle: cfg?.gridStyle === 'dots' ? 'dots' : defaultConfig.gridStyle,
    gridOpacity: typeof cfg?.gridOpacity === 'number' ? cfg.gridOpacity : defaultConfig.gridOpacity,
    shortcuts: {
      toggleSearch: cfg?.shortcuts?.toggleSearch ?? defaultShortcuts.toggleSearch,
      saveState: cfg?.shortcuts?.saveState ?? defaultShortcuts.saveState,
      centerWindow: cfg?.shortcuts?.centerWindow ?? defaultShortcuts.centerWindow
    },
    windowLayout: normalizeWindowLayout(cfg?.windowLayout)
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
    shortcuts: { ...config.shortcuts },
    windowLayout: JSON.parse(JSON.stringify(config.windowLayout))
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const toml = stringifyToml(data);
  fs.writeFileSync(configPath, toml);
}

export function getConfigPath(): string {
  return configPath;
}
