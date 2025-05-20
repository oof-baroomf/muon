const path = require('node:path');
const { app,
        BrowserWindow,
        BrowserView,
        ipcMain } = require('electron');

const TITLE_H = 24;      // logical px used for each view's draggable bar

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
    const screenY = Math.round(wy * scale + pan.y + TITLE_H * scale);

    // ------- safety: skip if any value is NaN/∞ (avoids "conversion failure")-------
    if (![screenX, screenY, w * scale, h * scale].every(Number.isFinite)) return;

    // Apply zoom factor first for new views
    view.webContents.setZoomFactor(scale);
    view.__lastZoom = scale; // Record the initial zoom factor applied

    view.setBounds({
      x: screenX,
      y: screenY,
      width:  Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale))
    });
    views.push(view);
    view.webContents.loadURL(url).catch(console.error);

    return view.webContents.id;      // ← lets the renderer know which view it spawned
  });

  ipcMain.on('canvas-transform', (_e, t) => {
    pan   = t.pan;
    scale = t.scale;
    updateLayout();                          // run immediately, no delay
  });

  ipcMain.on('update-views-zoom-factor', (_e, finalScale) => {
    views.forEach(v => {
      // Use finalScale which is the scale after zoom burst has ended
      if (Math.abs((v.__lastZoom ?? 1) - finalScale) > 1e-3) {
        v.webContents.setZoomFactor(finalScale);
        v.__lastZoom = finalScale;
      }
    });
  });

  function updateLayout () {
    views.forEach(v => {
      const { x, y } = v.__worldPos;
      const { w = 1024, h = 768 } = v.__size || {}; // default if missing
      const screenX = Math.round(x * scale + pan.x);
      const screenY = Math.round(y * scale + pan.y + TITLE_H * scale);

      // ------- safety: skip if any value is NaN/∞ (avoids "conversion failure")-------
      if (![screenX, screenY, w * scale, h * scale].every(Number.isFinite)) return;

      // Only apply bounds change here - zoom factor is handled by update-views-zoom-factor
      v.setBounds({
        x: screenX,
        y: screenY,
        width:  Math.max(1, Math.round(w * scale)),
        height: Math.max(1, Math.round(h * scale))
      });
    });
  }
}

app.whenReady().then(createWindow);
