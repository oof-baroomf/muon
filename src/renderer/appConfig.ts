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

export function applyGridStyle(root: HTMLElement) {
  const color = '#222';
  if (config.gridStyle === 'dots') {
    root.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
  } else if (config.gridStyle === 'cross') {
    root.style.backgroundImage =
      `linear-gradient(transparent calc(50% - 1px), ${color} calc(50% - 1px), ${color} calc(50% + 1px), transparent calc(50% + 1px)),` +
      `linear-gradient(90deg, transparent calc(50% - 1px), ${color} calc(50% - 1px), ${color} calc(50% + 1px), transparent calc(50% + 1px))`;
  } else {
    root.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
  }
  root.style.backgroundRepeat = 'repeat';
}
