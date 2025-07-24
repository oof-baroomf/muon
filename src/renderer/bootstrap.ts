import { loadConfig, setConfig, AppConfig } from './settings/appConfig';
import { applyGridStyle } from './settings/gridStyles';
import { DesktopState, loadState } from './state';
import { WindowData } from './windowManager';
import { TransformState } from './desktopTransform';

export interface BootstrapDeps {
  root: HTMLElement;
  windows: WindowData[];
  transform: TransformState;
  rebuild: () => void;
  apply: () => void;
}

export async function bootstrap(d: BootstrapDeps) {
  await loadConfig();
  applyGridStyle(d.root);
  const state: DesktopState = await loadState();
  d.windows.splice(0, d.windows.length, ...state.windows);
  d.transform.scale = state.transform.scale;
  d.transform.offsetX = state.transform.x;
  d.transform.offsetY = state.transform.y;
  d.rebuild();
  window.electronAPI.receive('config:updated', (cfg: AppConfig) => {
    setConfig(cfg);
    applyGridStyle(d.root);
    d.apply();
  });
}
