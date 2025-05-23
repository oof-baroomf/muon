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
      webPreferences: {
        preload: path.join(__dirname, 'titlebar-preload.js'),  // we'll inject a tiny HTML bar
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        transparent: true
      }
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
    view.webContents.loadURL(`data:text/html,
      <style>
        body{margin:0;background:#333;color:#eee;
             height:${TITLE_H}px;display:flex;align-items:center}
        span{flex:1;padding-left:8px;font:12px sans-serif;}
      </style>
      <span>${encodeURIComponent(url)}</span>`).catch(console.error);

    const page = new BrowserView({
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    page.__worldPos = view.__worldPos;      // share same metadata
    page.__size     = view.__size;

    win.addBrowserView(page);
    win.setTopBrowserView(page);            // page sits above the bar

    page.webContents.setZoomFactor(scale);
    page.webContents.loadURL(url).catch(console.error);

    views.push({ bar: view, page });        // keep them paired

    // initial placement for both:
    positionPair({bar:view, page});

    return page.webContents.id;             // tell renderer which content-view it controls
  });

  ipcMain.on('canvas-transform', (_e, t) => {
    pan   = t.pan;
    scale = t.scale;
    updateLayout();                          // run immediately, no delay
  });

  ipcMain.on('update-view-bounds', (_e, { id, pos, size }) => {
    const v = views.find(v => v.webContents.id === id);
    if (!v) return;

    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y))
      v.__worldPos = { x: pos.x, y: pos.y };

    if (size && Number.isFinite(size.w) && Number.isFinite(size.h))
      v.__size = { w: size.w, h: size.h };

    updateLayout();
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

  function positionPair({bar, page}) {
    const {x, y} = bar.__worldPos;
    const {w, h} = bar.__size;
    const screenX = Math.round(x * scale + pan.x);
    const screenY = Math.round(y * scale + pan.y);

    if (![screenX, screenY, w * scale, h * scale].every(Number.isFinite)) return;

    bar.setBounds({ x: screenX,
                    y: screenY,
                    width:  Math.max(1, Math.round(w * scale)),
                    height: Math.max(1, Math.round(TITLE_H * scale)) });

    page.setBounds({ x: screenX,
                     y: screenY + Math.round(TITLE_H * scale),
                     width:  Math.max(1, Math.round(w * scale)),
                     height: Math.max(1, Math.round(h * scale)) });
  }

  function updateLayout () {
    views.forEach(positionPair);
  }
}

app.whenReady().then(createWindow);
