import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopState } from './renderer/state';
import type { AppConfig } from './config';

contextBridge.exposeInMainWorld('electronAPI', {
  loadState: (): Promise<DesktopState> => ipcRenderer.invoke('state:load'),
  saveState: (state: DesktopState) => ipcRenderer.send('state:save', state),
  loadConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg: AppConfig) => ipcRenderer.send('config:save', cfg),
  send: <T extends unknown[]>(channel: string, ...args: T) => {
    ipcRenderer.send(channel, ...args);
  },
  receive: <T extends unknown[]>(channel: string, func: (...args: T) => void) => {
    const subscription = (_event: unknown, ...args: T) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  readNote: (path: string): Promise<string> => ipcRenderer.invoke('note:read', path),
  writeNote: (path: string, content: string) => ipcRenderer.send('note:write', path, content)
});
