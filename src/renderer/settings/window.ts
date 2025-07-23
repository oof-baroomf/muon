import '../styles.css';
import { loadConfig, saveConfig } from './appConfig';

(async () => {
  const root = document.getElementById('root') as HTMLElement;
  const cfg = await loadConfig();

  const box = document.createElement('div');
  box.className = 'bg-zinc-800 border border-zinc-600 rounded-lg p-4 w-64 space-y-4';

  const gridSizeRow = document.createElement('div');
  const gridSizeLabel = document.createElement('label');
  gridSizeLabel.textContent = 'Grid Size';
  gridSizeLabel.className = 'block text-sm';
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'mt-1 flex items-center gap-1';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = '4';
  sizeInput.max = '256';
  sizeInput.value = String(cfg.gridSize);
  sizeInput.className = 'w-full bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  const sizeUnit = document.createElement('span');
  sizeUnit.textContent = 'px';
  sizeWrap.appendChild(sizeInput);
  sizeWrap.appendChild(sizeUnit);
  sizeInput.addEventListener('change', () => {
    cfg.gridSize = parseInt(sizeInput.value) || cfg.gridSize;
    saveConfig(cfg);
  });
  gridSizeRow.appendChild(gridSizeLabel);
  gridSizeRow.appendChild(sizeWrap);

  const styleRow = document.createElement('div');
  const styleLabel = document.createElement('label');
  styleLabel.textContent = 'Grid Style';
  styleLabel.className = 'block text-sm';
  const styleSelect = document.createElement('select');
  styleSelect.className = 'mt-1 w-full bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  for (const opt of ['lines', 'cross', 'dots']) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    if (cfg.gridStyle === opt) o.selected = true;
    styleSelect.appendChild(o);
  }
  styleSelect.addEventListener('change', () => {
    cfg.gridStyle = styleSelect.value as any;
    saveConfig(cfg);
  });
  styleRow.appendChild(styleLabel);
  styleRow.appendChild(styleSelect);

  const opacityRow = document.createElement('div');
  const opacityLabel = document.createElement('label');
  opacityLabel.textContent = 'Grid Opacity';
  opacityLabel.className = 'block text-sm';
  const opacityInput = document.createElement('input');
  opacityInput.type = 'range';
  opacityInput.min = '0';
  opacityInput.max = '1';
  opacityInput.step = '0.05';
  opacityInput.value = String(cfg.gridOpacity);
  opacityInput.className = 'mt-1 w-full';
  opacityInput.addEventListener('input', () => {
    cfg.gridOpacity = parseFloat(opacityInput.value);
    saveConfig(cfg);
  });
  opacityRow.appendChild(opacityLabel);
  opacityRow.appendChild(opacityInput);

  box.appendChild(gridSizeRow);
  box.appendChild(styleRow);
  box.appendChild(opacityRow);
  root.appendChild(box);
})();
