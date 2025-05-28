const { app, BrowserWindow, BrowserView, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
const views = new Map(); // To keep track of BrowserView instances

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    fullscreen: true,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    },
    show: false,
    backgroundColor: '#121212'
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    views.forEach(view => {
      if (view && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
    });
    views.clear();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('create-new-view', (event, urlToLoad) => {
  if (!mainWindow) return;

  const viewId = `view-${Date.now()}`;
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.addBrowserView(view);
  views.set(viewId, view);

  const [winWidth, winHeight] = mainWindow.getSize();
  const viewWidth = Math.floor(winWidth * 0.6);
  const viewHeight = Math.floor(winHeight * 0.7);
  const x = Math.floor((winWidth - viewWidth) / 2);
  const y = Math.floor((winHeight - viewHeight) / 2);

  view.setBounds({ x, y, width: viewWidth, height: viewHeight });
  view.setAutoResize({ width: true, height: true });
  view.webContents.loadURL(urlToLoad).catch(err => {
    console.error(`Failed to load URL ${urlToLoad}:`, err);
    view.webContents.loadURL(`data:text/html,<h1>Error loading: ${urlToLoad}</h1><p>${err.message}</p>`);
  });

  event.sender.send('view-created', {
    id: viewId,
    x,
    y,
    width: viewWidth,
    height: viewHeight,
    url: urlToLoad
  });
});

ipcMain.on('focus-view', (event, viewId) => {
  const view = views.get(viewId);
  if (view && !view.webContents.isDestroyed()) {
    mainWindow.removeBrowserView(view);
    mainWindow.addBrowserView(view);
    view.webContents.focus();
  }
});

ipcMain.on('update-view-bounds', (event, { viewId, bounds }) => {
  const view = views.get(viewId);
  if (view && !view.webContents.isDestroyed() && mainWindow) {
    const contentBounds = mainWindow.getContentBounds();
    const newBounds = {
        x: Math.max(0, Math.min(bounds.x, contentBounds.width - bounds.width)),
        y: Math.max(0, Math.min(bounds.y, contentBounds.height - bounds.height)),
        width: Math.max(100, Math.min(bounds.width, contentBounds.width)),
        height: Math.max(100, Math.min(bounds.height, contentBounds.height))
    };
    view.setBounds(newBounds);
  }
});

ipcMain.on('close-view', (event, viewId) => {
  const view = views.get(viewId);
  if (view && !view.webContents.isDestroyed() && mainWindow) {
    mainWindow.removeBrowserView(view);
    views.delete(viewId);
    event.sender.send('view-closed-ack', viewId);
  }
});

ipcMain.on('navigate-view', (event, { viewId, action }) => {
    const view = views.get(viewId);
    if (view && !view.webContents.isDestroyed()) {
        if (action === 'back' && view.webContents.canGoBack()) {
            view.webContents.goBack();
        } else if (action === 'forward' && view.webContents.canGoForward()) {
            view.webContents.goForward();
        } else if (action === 'reload') {
            view.webContents.reload();
        }
    }
});

ipcMain.on('zoom-view', (event, { viewId, zoomFactor }) => {
  const view = views.get(viewId);
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.setZoomFactor(zoomFactor);
  }
});

ipcMain.on('set-view-mouse-passthrough', (event, { viewId, passthrough }) => {
  const view = views.get(viewId);
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.setIgnoreMenuShortcuts(!passthrough);
  }
});
