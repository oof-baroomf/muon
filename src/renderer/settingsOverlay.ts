import { getConfig, saveConfig, applyGridStyle, AppConfig } from './appConfig';

interface Deps {
  root: HTMLElement;
  applyTransform: () => void;
}

let deps: Deps;
let overlay: HTMLElement | null = null;

export function initSettingsOverlay(d: Deps) {
  deps = d;
  window.electronAPI.receive('settings:open', showSettings);
}

function hide() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
}

function createOption(value: string, text: string, current: string) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  if (value === current) o.selected = true;
  return o;
}

function update(config: AppConfig) {
  saveConfig(config);
  applyGridStyle(deps.root);
  deps.applyTransform();
}

async function showSettings() {
  if (overlay) return;
  const config = { ...getConfig() };

  overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-black/60 flex items-start justify-center pt-24';
  overlay.style.zIndex = '50';
  overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });

  const box = document.createElement('div');
  box.className = 'bg-zinc-800 border border-zinc-600 rounded-lg w-64 p-4 space-y-4';

  const sizeLabel = document.createElement('label');
  sizeLabel.className = 'block text-sm text-zinc-300';
  sizeLabel.textContent = 'Grid Size';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = '4';
  sizeInput.max = '256';
  sizeInput.value = String(config.gridSize);
  sizeInput.className = 'mt-1 w-full bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  sizeInput.addEventListener('change', () => {
    config.gridSize = parseInt(sizeInput.value) || config.gridSize;
    update(config);
  });

  const styleLabel = document.createElement('label');
  styleLabel.className = 'block text-sm text-zinc-300';
  styleLabel.textContent = 'Grid Style';
  const styleSelect = document.createElement('select');
  styleSelect.className = 'mt-1 w-full bg-zinc-700 text-zinc-200 px-2 py-1 rounded';
  styleSelect.appendChild(createOption('lines', 'Lines', config.gridStyle));
  styleSelect.appendChild(createOption('cross', 'Cross', config.gridStyle));
  styleSelect.appendChild(createOption('dots', 'Dots', config.gridStyle));
  styleSelect.addEventListener('change', () => {
    config.gridStyle = styleSelect.value as any;
    update(config);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.className = 'px-3 py-1 bg-zinc-700 rounded text-zinc-200';
  closeBtn.onclick = hide;

  box.appendChild(sizeLabel);
  box.appendChild(sizeInput);
  box.appendChild(styleLabel);
  box.appendChild(styleSelect);
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  deps.root.appendChild(overlay);
}
