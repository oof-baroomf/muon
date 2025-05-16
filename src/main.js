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
    views.push(view);
    win.addBrowserView(view);
    view.webContents.loadURL(url);
    view.__worldPos = { x: wx, y: wy };
    updateLayout();
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
