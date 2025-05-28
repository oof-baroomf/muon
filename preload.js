const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onViewCreated: (callback) => ipcRenderer.on('view-created', (_event, value) => callback(value)),
  onViewClosedAck: (callback) => ipcRenderer.on('view-closed-ack', (_event, value) => callback(value)),
  createNewView: (url) => ipcRenderer.send('create-new-view', url),
  focusView: (viewId) => ipcRenderer.send('focus-view', viewId),
  updateViewBounds: (viewId, bounds) => ipcRenderer.send('update-view-bounds', { viewId, bounds }),
  closeView: (viewId) => ipcRenderer.send('close-view', viewId),
  navigateView: (viewId, action) => ipcRenderer.send('navigate-view', { viewId, action }),
  setViewMousePassthrough: (viewId, passthrough) => ipcRenderer.send('set-view-mouse-passthrough', { viewId, passthrough }),
  sendKeyEvent: (key) => ipcRenderer.send('key-event', key),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  zoomView: (viewId, zoomFactor) => ipcRenderer.send('zoom-view', { viewId, zoomFactor }),
});
