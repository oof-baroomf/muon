export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'cross' | 'dots';
}

let config: AppConfig = { gridSize: 32, gridStyle: 'lines' };

export async function loadConfig(): Promise<AppConfig> {
  const c = await window.electronAPI.loadConfig();
  config = {
    gridSize: typeof c.gridSize === 'number' ? c.gridSize : 32,
    gridStyle: c.gridStyle || 'lines'
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

