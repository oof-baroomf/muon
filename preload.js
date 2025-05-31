const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    createView: (id, url) => ipcRenderer.invoke('create-view', { id, url }),
    updateViewBounds: (id, bounds) => ipcRenderer.send('update-view-bounds', { id, bounds }),
    removeView: (id) => ipcRenderer.send('remove-view', id),
    navigateView: (id, action, url = null) => ipcRenderer.send('navigate-view', { id, action, url }),
    focusView: (id) => ipcRenderer.send('focus-view', id),
    onViewCrashed: (callback) => ipcRenderer.on('view-crashed', (event, id) => callback(id))
});
