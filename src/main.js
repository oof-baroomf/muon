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
  const VIEW_W = 1024;
  const VIEW_H = 768;

  ipcMain.handle('spawn-browserview', (_e, { wx, wy, url }) => {
    const view = new BrowserView({
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    view.__worldPos = { x: wx, y: wy };

    win.addBrowserView(view);          // attach
    win.setTopBrowserView(view);       // …and ensure it’s above others

    // initial size/position derived from current canvas transform
    view.setBounds({
      x: Math.round((wx + pan.x) * scale),
      y: Math.round((wy + pan.y) * scale),
      width: Math.round(VIEW_W * scale),
      height: Math.round(VIEW_H * scale)
    });
    view.setAutoResize({ width: true, height: true });   // keeps it in-window
    views.push(view);

    // keep websites reporting a constant screen size
    view.webContents.enableDeviceEmulation({
      screenPosition: 'desktop',
      screenSize: { width: VIEW_W, height: VIEW_H },
      viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: 0,
      viewSize: { width: VIEW_W, height: VIEW_H },
      scale
    });

    view.webContents.loadURL(url).catch(console.error);
  });

  ipcMain.on('canvas-transform', (_e, t) => {
    pan = t.pan;
    scale = t.scale;
    updateLayout();
  });

  function updateLayout () {
    views.forEach(v => {
      const { x, y } = v.__worldPos;
      v.setBounds({
        x: Math.round((x + pan.x) * scale),
        y: Math.round((y + pan.y) * scale),
        width: Math.round(VIEW_W * scale),
        height: Math.round(VIEW_H * scale)
      });

      v.webContents.enableDeviceEmulation({
        screenPosition: 'desktop',
        screenSize: { width: VIEW_W, height: VIEW_H },
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: 0,
        viewSize: { width: VIEW_W, height: VIEW_H },
        scale
      });
    });
  }
}

app.whenReady().then(createWindow);
