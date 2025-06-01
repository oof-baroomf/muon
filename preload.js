const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    createView: (data) => ipcRenderer.send('create-view', data),
    updateViewVisuals: (data) => ipcRenderer.send('update-view-visuals', data),
    removeView: (id) => ipcRenderer.send('remove-view', id)
});
