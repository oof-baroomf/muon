const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
const views = new Map(); // To store { viewInstance, logicalWidth, logicalHeight }

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
        icon: path.join(__dirname, 'assets', 'icon.png')
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        views.forEach(view => {
            if (view && mainWindow && !mainWindow.isDestroyed()) {
                const currentViews = mainWindow.getBrowserViews();
                if (currentViews.includes(view)) {
                    mainWindow.removeBrowserView(view);
                }
            }
        });
        views.clear();
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('create-view', async (event, { id, url, x, y, width, height, logicalWidth, logicalHeight, initialScale }) => {
    if (!mainWindow) return null;
    if (views.has(id)) {
        const existingView = views.get(id);
        try {
            await existingView.webContents.loadURL(url);
        } catch (error) {
            console.error(`Failed to load URL ${url} in existing view ${id}:`, error);
        }
        return id;
    }

    const view = new BrowserView({
        webPreferences: {
            contextIsolation: true,
        }
    });
    mainWindow.addBrowserView(view);
    views.set(id, { viewInstance: view, logicalWidth: logicalWidth, logicalHeight: logicalHeight });

    view.webContents.once('did-finish-load', () => {
        if (view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.setZoomFactor(initialScale);
        }
    });

    view.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
    view.setBackgroundColor('#ffffff');
    try {
        await view.webContents.loadURL(url);
    } catch (error) {
        console.error(`Failed to load URL ${url} in new view ${id}:`, error);
        view.webContents.loadURL(`data:text/html,<h1>Error loading page: ${url}</h1><p>${error.message}</p>`);
    }
    return id;
});

ipcMain.on('update-view-visuals', (event, { id, visualX, visualY, visualWidth, visualHeight, newScale }) => {
    const viewObject = views.get(id);
    if (viewObject && viewObject.viewInstance && mainWindow && !mainWindow.isDestroyed() &&
        viewObject.viewInstance.webContents && !viewObject.viewInstance.webContents.isDestroyed()) {
        const actualView = viewObject.viewInstance;
        const w = Math.max(1, Math.round(visualWidth));
        const h = Math.max(1, Math.round(visualHeight));
        try {
            actualView.setBounds({ x: Math.round(visualX), y: Math.round(visualY), width: w, height: h });
            // Keep device emulation settings but update zoom factor
            actualView.webContents.setZoomFactor(newScale);
        } catch (error) {
            console.error("Error setting bounds for view", id, error);
        }
    }
});

ipcMain.on('remove-view', (event, id) => {
    const viewObject = views.get(id);
    if (viewObject && viewObject.viewInstance && mainWindow && !mainWindow.isDestroyed()) {
        const actualView = viewObject.viewInstance;
        const currentViews = mainWindow.getBrowserViews();
        if (currentViews.includes(actualView)) {
            mainWindow.removeBrowserView(actualView);
        }
        views.delete(id);
    }
});

ipcMain.on('focus-view', (event, id) => {
    const viewObject = views.get(id);
    if (viewObject && viewObject.viewInstance && mainWindow && !mainWindow.isDestroyed()) {
        const actualView = viewObject.viewInstance;
        const currentViews = mainWindow.getBrowserViews();
        if (currentViews.includes(actualView)) {
            mainWindow.removeBrowserView(actualView);
            mainWindow.addBrowserView(actualView);
        }
        if (actualView.webContents) {
            actualView.webContents.focus();
        }
    }
});
