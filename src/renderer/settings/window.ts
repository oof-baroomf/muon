import '../styles.css';
import { loadConfig } from './appConfig';

(async () => {
  const root = document.getElementById('root') as HTMLElement;
  const cfg = await loadConfig();
  const cfgPath = await window.electronAPI.configPath();

  root.classList.add('space-y-4', 'text-sm');

  const heading = document.createElement('div');
  heading.className = 'text-base font-semibold';
  heading.textContent = 'Config is file-only';

  const pathRow = document.createElement('div');
  pathRow.textContent = `Edit config.toml directly at: ${cfgPath}`;
  pathRow.className = 'text-xs text-zinc-300';

  const info = document.createElement('p');
  info.textContent = 'In-app controls are disabled. Update values in config.toml and restart Muon.';

  const preview = document.createElement('pre');
  preview.className = 'bg-zinc-800 text-zinc-100 p-3 text-xs overflow-auto';
  preview.textContent = JSON.stringify(cfg, null, 2);

  root.appendChild(heading);
  root.appendChild(info);
  root.appendChild(pathRow);
  root.appendChild(preview);
})();
