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

    // initial size/position derived from current canvas transform
    const w = 1024, h = 768;
    view.setBounds({
      x: Math.round((wx + pan.x) * scale),
      y: Math.round((wy + pan.y) * scale),
      width: Math.round(w * scale),
      height: Math.round(h * scale)
    });

    win.addBrowserView(view);       // now definitely inside the window
    views.push(view);
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
      const w = 1024, h = 768;
      v.setBounds({
        x: Math.round((x + pan.x) * scale),
        y: Math.round((y + pan.y) * scale),
        width: Math.round(w * scale),
        height: Math.round(h * scale)
      });
    });
  }
}

app.whenReady().then(createWindow);
