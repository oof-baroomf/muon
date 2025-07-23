import '../styles.css';
import { loadConfig, saveConfig } from './appConfig';
import { createShortcutInput } from './shortcutInput';

(async () => {
  const root = document.getElementById('root') as HTMLElement;
  const cfg = await loadConfig();

  root.classList.add('space-y-4');

  const firstRow = document.createElement('div');
  firstRow.className = 'flex gap-4';

  const sizeCol = document.createElement('div');
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
  sizeInput.className = 'w-20 bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  const sizeUnit = document.createElement('span');
  sizeUnit.textContent = 'px';
  sizeWrap.appendChild(sizeInput);
  sizeWrap.appendChild(sizeUnit);
  sizeInput.addEventListener('change', () => {
    cfg.gridSize = parseInt(sizeInput.value) || cfg.gridSize;
    saveConfig(cfg);
  });
  sizeCol.appendChild(gridSizeLabel);
  sizeCol.appendChild(sizeWrap);

  const styleCol = document.createElement('div');
  const styleLabel = document.createElement('label');
  styleLabel.textContent = 'Grid Style';
  styleLabel.className = 'block text-sm';
  const styleSelect = document.createElement('select');
  styleSelect.className = 'mt-1 bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  for (const opt of ['lines', 'dots']) {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
    if (cfg.gridStyle === opt) o.selected = true;
    styleSelect.appendChild(o);
  }
  styleSelect.addEventListener('change', () => {
    cfg.gridStyle = styleSelect.value as 'lines' | 'dots';
    saveConfig(cfg);
  });
  styleCol.appendChild(styleLabel);
  styleCol.appendChild(styleSelect);

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

  firstRow.appendChild(sizeCol);
  firstRow.appendChild(styleCol);

  root.appendChild(firstRow);
  root.appendChild(opacityRow);

  const scTitle = document.createElement('div');
  scTitle.textContent = 'Keyboard Shortcuts';
  scTitle.className = 'pt-2 text-sm font-semibold';
  const scContainer = document.createElement('div');
  scContainer.className = 'space-y-2';

  const defs: [keyof typeof cfg.shortcuts, string][] = [
    ['toggleSearch', 'Toggle Search'],
    ['saveState', 'Save Layout'],
    ['centerWindow', 'Center Window']
  ];
  for (const [key, labelText] of defs) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'w-40 text-sm';
    const input = createShortcutInput(cfg.shortcuts[key], val => {
      cfg.shortcuts[key] = val;
      saveConfig(cfg);
    });
    row.appendChild(label);
    row.appendChild(input);
    scContainer.appendChild(row);
  }

  root.appendChild(scTitle);
  root.appendChild(scContainer);
})();
