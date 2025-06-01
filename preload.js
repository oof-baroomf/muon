const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    createView: (data) => ipcRenderer.invoke('create-view', data),
    updateViewVisuals: (data) => ipcRenderer.send('update-view-visuals', data),
    removeView: (id) => ipcRenderer.send('remove-view', id),
    focusView: (id) => ipcRenderer.send('focus-view', id)
});
