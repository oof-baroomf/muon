import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'dots';
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

const configPath = path.join(app.getPath('userData'), 'config.toml');

export function loadConfig(): AppConfig {
  try {
    const text = fs.readFileSync(configPath, 'utf-8');
    const lines = text.split(/\r?\n/);
    const cfg: any = {};
    for (const line of lines) {
      const m = line.match(/^\s*([\w_]+)\s*=\s*(.+)\s*$/);
      if (!m) continue;
      let val: any = m[2].trim();
      if (/^".*"$/.test(val)) val = val.slice(1, -1);
      else {
        const num = Number(val);
        if (!Number.isNaN(num)) val = num;
      }
      cfg[m[1]] = val;
    }
    return {
      gridSize: typeof cfg.grid_size === 'number' ? cfg.grid_size : 32,
      gridStyle: cfg.grid_style === 'dots' ? 'dots' : 'lines',
      gridOpacity: typeof cfg.grid_opacity === 'number' ? cfg.grid_opacity : 0.15,
      shortcuts: {
        toggleSearch: typeof cfg.shortcut_toggle_search === 'string'
          ? cfg.shortcut_toggle_search
          : defaultShortcuts.toggleSearch,
        saveState: typeof cfg.shortcut_save_state === 'string'
          ? cfg.shortcut_save_state
          : defaultShortcuts.saveState,
        centerWindow: typeof cfg.shortcut_center_window === 'string'
          ? cfg.shortcut_center_window
          : defaultShortcuts.centerWindow
      }
    };
  } catch {
    return {
      gridSize: 32,
      gridStyle: 'lines',
      gridOpacity: 0.15,
      shortcuts: { ...defaultShortcuts }
    };
  }
}

export function saveConfig(config: AppConfig) {
  const text =
    `grid_size = ${config.gridSize}\n` +
    `grid_style = "${config.gridStyle}"\n` +
    `grid_opacity = ${config.gridOpacity}\n` +
    `shortcut_toggle_search = "${config.shortcuts.toggleSearch}"\n` +
    `shortcut_save_state = "${config.shortcuts.saveState}"\n` +
    `shortcut_center_window = "${config.shortcuts.centerWindow}"\n`;
  fs.writeFileSync(configPath, text);
}
