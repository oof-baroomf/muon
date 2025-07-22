import { AppConfig, getConfig } from './appConfig';

export function applyGridStyle(root: HTMLElement, config: AppConfig = getConfig()) {
  const color = '#222';
  if (config.gridStyle === 'dots') {
    root.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
  } else if (config.gridStyle === 'cross') {
    const crossLen = Math.max(4, Math.min(config.gridSize / 2, 8));
    const vLine = `linear-gradient(${color} 0 0)`;
    const hLine = `linear-gradient(90deg, ${color} 0 0)`;
    root.style.backgroundImage = `${vLine},${hLine}`;
    root.style.backgroundSize = `${config.gridSize}px ${crossLen}px, ${crossLen}px ${config.gridSize}px`;
    root.style.backgroundPosition = 'center';
  } else {
    root.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  }
  root.style.backgroundRepeat = 'repeat';
}
