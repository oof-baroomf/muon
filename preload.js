const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    createView: (id, url) => ipcRenderer.invoke('create-view', { id, url }),
    updateViewBounds: (id, bounds) => ipcRenderer.send('update-view-bounds', { id, bounds }),
    removeViewFromUI: (id) => ipcRenderer.send('remove-view', id),
    navigateView: (id, action, url = null) => ipcRenderer.send('navigate-view', { id, action, url }),
    focusView: (id) => ipcRenderer.send('focus-view', id),
    onViewReadyForBounds: (callback) => ipcRenderer.on('view-ready-for-bounds', (event, id) => callback(id)),
    onViewCrashedOrRemoved: (callback) => ipcRenderer.on('view-crashed-or-removed', (event, id) => callback(id))
});
