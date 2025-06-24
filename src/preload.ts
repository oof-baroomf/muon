import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  loadState: (): Promise<any> => ipcRenderer.invoke('state:load'),
  saveState: (state: any) => ipcRenderer.send('state:save', state)
});
