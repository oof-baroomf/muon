import { WindowData, Transform } from './windowManager';

export interface DesktopState {
  windows: WindowData[];
  transform: Transform;
}

export async function loadState(): Promise<DesktopState> {
  const saved = await window.electronAPI.loadState();
  return {
    windows: saved?.windows || [],
    transform: {
      scale: saved?.transform?.scale || 1,
      x: saved?.transform?.x || 0,
      y: saved?.transform?.y || 0
    }
  };
}

export function saveState(windows: WindowData[], transform: Transform) {
  window.electronAPI.saveState({ windows, transform });
}
