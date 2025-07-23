import { AppConfig, getConfig } from './appConfig';

export function applyGridStyle(
  root: HTMLElement,
  config: AppConfig = getConfig()
) {
  const color = `rgba(255,255,255,${config.gridOpacity})`;
  if (config.gridStyle === 'dots') {
    root.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  } else {
    root.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  }
  root.style.backgroundRepeat = 'repeat';
  root.style.imageRendering = 'pixelated';
}
