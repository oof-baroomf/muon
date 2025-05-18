const path = require('node:path');
const { app,
        BrowserWindow,
        BrowserView,
        ipcMain } = require('electron');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: {
      // `preload.js` lives one directory above `src/`
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const views = [];
  let pan = {x: 0, y: 0};
  let scale = 1;

  ipcMain.handle('spawn-browserview', (_e, { wx, wy, url }) => {
    const view = new BrowserView({
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    view.__worldPos = { x: wx, y: wy };

    win.addBrowserView(view);          // attach
    win.setTopBrowserView(view);       // …and ensure it’s above others

    const w = 1024, h = 768;          // logical size inside the page
    view.__size = { w, h };           // store once
    const screenX = Math.round(wx * scale + pan.x);
    const screenY = Math.round(wy * scale + pan.y);
    view.setBounds({
      x: screenX,
      y: screenY,
      width:  Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale))
    });
    view.__lastZoom = -1;                 // force first zoom update
    view.webContents.setZoomFactor(scale); // scale the pixels, not the layout
    views.push(view);
    view.webContents.loadURL(url).catch(console.error);
  });

  ipcMain.on('canvas-transform', (_e, t) => {
    pan   = t.pan;
    scale = t.scale;
    updateLayout();          // ← run every event, no delay
  });

  function updateLayout () {
    views.forEach(v => {
      const { x, y } = v.__worldPos;
      const { w = 1024, h = 768 } = v.__size || {}; // default if missing
      const screenX = Math.round(x * scale + pan.x);
      const screenY = Math.round(y * scale + pan.y);
      if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return; // safety
      v.setBounds({
        x: screenX,
        y: screenY,
        width:  Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale))
      });
      if (Math.abs((v.__lastZoom ?? 1) - scale) > 1e-3) {
        v.webContents.setZoomFactor(scale);
        v.__lastZoom = scale;
      }
    });
  }
}

app.whenReady().then(createWindow);
