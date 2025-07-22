import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'cross' | 'dots';
}

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
      gridStyle: (cfg.grid_style as any) || 'lines'
    };
  } catch {
    return { gridSize: 32, gridStyle: 'lines' };
  }
}

export function saveConfig(config: AppConfig) {
  const text = `grid_size = ${config.gridSize}\ngrid_style = "${config.gridStyle}"\n`;
  fs.writeFileSync(configPath, text);
}
