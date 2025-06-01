const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    createView: (data) => ipcRenderer.invoke('create-view', data),
    updateViewBounds: (data) => ipcRenderer.send('update-view-bounds', data),
    removeView: (id) => ipcRenderer.send('remove-view', id),
    focusView: (id) => ipcRenderer.send('focus-view', id)
});
