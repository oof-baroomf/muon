const { app, BrowserWindow, BrowserView, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
const views = new Map();

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.floor(width * 0.85),
        height: Math.floor(height * 0.85),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        frame: true,
        backgroundColor: '#181818'
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
        views.forEach(view => {
            if (view && !view.isDestroyed()) {
                view.webContents.destroy();
            }
        });
        views.clear();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('create-view', (event, { id, url }) => {
    if (!mainWindow) return null;

    const view = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    mainWindow.addBrowserView(view);
    views.set(id, view);

    view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    view.setBackgroundColor('#FFFFFF');
    view.webContents.loadURL(url).catch(err => {
        console.error(`Failed to load URL ${url} for view ${id}:`, err);
    });
    return id;
});

ipcMain.on('update-view-bounds', (event, { id, bounds }) => {
    const view = views.get(id);
    if (view && mainWindow && !view.isDestroyed()) {
        const validatedBounds = {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.max(1, Math.round(bounds.width)),
            height: Math.max(1, Math.round(bounds.height))
        };
        view.setBounds(validatedBounds);
    }
});

ipcMain.on('remove-view', (event, id) => {
    const view = views.get(id);
    if (view && mainWindow && !view.isDestroyed()) {
        mainWindow.removeBrowserView(view);
        view.webContents.destroy();
        views.delete(id);
    }
});

ipcMain.on('navigate-view', (event, { id, action, url }) => {
    const view = views.get(id);
    if (view && !view.isDestroyed()) {
        const contents = view.webContents;
        if (action === 'loadURL' && url) {
            contents.loadURL(url).catch(err => console.error(`Failed to load URL ${url} for view ${id}:`, err));
        } else if (action === 'goBack' && contents.canGoBack()) {
            contents.goBack();
        } else if (action === 'goForward' && contents.canGoForward()) {
            contents.goForward();
        } else if (action === 'reload') {
            contents.reload();
        }
    }
});

ipcMain.on('focus-view', (event, id) => {
    const view = views.get(id);
    if (view && !view.isDestroyed()) {
        view.webContents.focus();
    }
});
