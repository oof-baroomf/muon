import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadState: (): Promise<any> => ipcRenderer.invoke('state:load'),
  saveState: (state: any) => ipcRenderer.send('state:save', state),
  loadConfig: (): Promise<any> => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg: any) => ipcRenderer.send('config:save', cfg),
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  receive: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  readNote: (path: string): Promise<string> => ipcRenderer.invoke('note:read', path),
  writeNote: (path: string, content: string) => ipcRenderer.send('note:write', path, content)
});
