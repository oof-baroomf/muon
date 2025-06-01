const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
const views = new Map();
const DEFAULT_VIEW_LOGICAL_WIDTH = 1280;
const DEFAULT_VIEW_LOGICAL_HEIGHT = 720;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        }
    });
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());

function applyScalingCSS(browserView, canvasScale) {
    if (!browserView || !browserView.webContents || browserView.webContents.isDestroyed()) return;
    // Ensure canvasScale is not zero to prevent issues.
    const effectiveScale = Math.max(canvasScale, 0.001);

    const css = `
        body {
            width: ${DEFAULT_VIEW_LOGICAL_WIDTH}px !important;
            height: ${DEFAULT_VIEW_LOGICAL_HEIGHT}px !important;
            transform: scale(${effectiveScale}) !important;
            transform-origin: top left !important;
            overflow: auto !important;
            margin: 0 !important; /* Reset default body margin */
        }
        html {
            overflow: hidden !important;
            width: 100vw; /* Ensure html element takes full view bounds */
            height: 100vh;
            margin: 0;
        }
    `;
    browserView.webContents.insertCSS(css).catch(err => {
        if (!browserView.webContents.isDestroyed()) console.error("Failed to insert CSS: ", err);
    });
}

ipcMain.on('create-view', (event, { id, url, x, y, width, height, canvasScale }) => {
    if (!mainWindow) return;
    const view = new BrowserView({ webPreferences: { contextIsolation: true } });
    mainWindow.addBrowserView(view);
    views.set(id, view);

    view.setBounds({ // Use the width and height calculated by the renderer
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
    });
    view.webContents.loadURL(url);
    applyScalingCSS(view, canvasScale);
    view.webContents.on('did-finish-load', () => applyScalingCSS(view, canvasScale));
});

ipcMain.on('update-view-visuals', (event, { id, x, y, width, height, canvasScale }) => {
    const view = views.get(id);
    if (view) {
        view.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
        applyScalingCSS(view, canvasScale);
    }
});

ipcMain.on('remove-view', (event, id) => {
    const view = views.get(id);
    if (view) {
        mainWindow.removeBrowserView(view);
        views.delete(id);
    }
});
