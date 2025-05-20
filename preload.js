const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  spawnView: ({ wx, wy, url }) => ipcRenderer.invoke('spawn-browserview', { wx, wy, url }),
  updateTransform: (pan, scale) => ipcRenderer.send('canvas-transform', { pan, scale }),
  updateViewsZoomFactor: (scale) => ipcRenderer.send('update-views-zoom-factor', scale),
  updateViewBounds:      ({ id, pos, size }) => ipcRenderer.send('update-view-bounds', { id, pos, size })
});
