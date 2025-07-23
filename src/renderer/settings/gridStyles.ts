import { AppConfig, getConfig } from './appConfig';

export function applyGridStyle(
  root: HTMLElement,
  config: AppConfig = getConfig()
) {
  const color = `rgba(34,34,34,${config.gridOpacity})`;
  if (config.gridStyle === 'dots') {
    root.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  } else if (config.gridStyle === 'cross') {
    const len = Math.max(4, Math.min(config.gridSize / 2, 8));
    const stroke = 1;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${config.gridSize}' height='${config.gridSize}'>` +
      `<rect x='${(config.gridSize - stroke) / 2}' y='${(config.gridSize - len) / 2}' width='${stroke}' height='${len}' fill='${color}'/>` +
      `<rect x='${(config.gridSize - len) / 2}' y='${(config.gridSize - stroke) / 2}' width='${len}' height='${stroke}' fill='${color}'/>` +
      `</svg>`;
    root.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
    root.style.backgroundPosition = 'top left';
  } else {
    root.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
    root.style.backgroundSize = `${config.gridSize}px ${config.gridSize}px`;
  }
  root.style.backgroundRepeat = 'repeat';
  root.style.imageRendering = 'pixelated';
}
