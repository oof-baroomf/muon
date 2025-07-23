import { AppConfig, getConfig } from './appConfig';

export function applyGridStyle(
  root: HTMLElement,
  config: AppConfig = getConfig()
) {
  const color = `rgba(255,255,255,${config.gridOpacity})`;
  if (config.gridStyle === 'dots') {
    root.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  } else if (config.gridStyle === 'cross') {
    const len = Math.max(4, Math.min(config.gridSize / 2, 8));
    const v = `linear-gradient(transparent calc(50% - ${len / 2}px), ${color} calc(50% - ${len / 2}px), ${color} calc(50% + ${len / 2}px), transparent calc(50% + ${len / 2}px))`;
    const h = `linear-gradient(90deg, transparent calc(50% - ${len / 2}px), ${color} calc(50% - ${len / 2}px), ${color} calc(50% + ${len / 2}px), transparent calc(50% + ${len / 2}px))`;
    root.style.backgroundImage = `${v},${h}`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
    root.style.backgroundPosition = 'center';
  } else {
    root.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  }
  root.style.backgroundRepeat = 'repeat';
  root.style.imageRendering = 'pixelated';
}
