const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadUrl: (url) => ipcRenderer.send('load-url', url),
    goBack: () => ipcRenderer.send('go-back'),
    setZoom: (factor) => ipcRenderer.send('set-zoom', factor),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    maximizeWindow: () => ipcRenderer.send('maximize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});
