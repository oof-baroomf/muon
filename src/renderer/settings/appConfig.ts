export interface AppConfig {
  gridSize: number;
  gridStyle: 'lines' | 'cross' | 'dots';
  gridOpacity: number;
}

let config: AppConfig = { gridSize: 32, gridStyle: 'lines', gridOpacity: 0.4 };

export async function loadConfig(): Promise<AppConfig> {
  const c = await window.electronAPI.loadConfig();
  config = {
    gridSize: typeof c.gridSize === 'number' ? c.gridSize : 32,
    gridStyle: c.gridStyle || 'lines',
    gridOpacity: typeof c.gridOpacity === 'number' ? c.gridOpacity : 0.4
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

