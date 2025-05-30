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
        views.forEach((viewInstance, id) => { // Iterate with viewInstance and id
            if (viewInstance instanceof BrowserView && !viewInstance.isDestroyed()) {
                viewInstance.webContents.destroy();
            } else if (!(viewInstance instanceof BrowserView)) {
                console.warn(`[WindowClosedCleanup] Item with id ${id} in views map was not a BrowserView:`, viewInstance);
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
    if (!mainWindow) {
        console.error('Create-view: mainWindow is not available.');
        return null;
    }

    try {
        const view = new BrowserView({ // Ensure BrowserView is correctly referenced
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
            console.error(`[CreateView] Failed to load URL ${url} for view ${id}:`, err);
            // Optionally, clean up the view if URL loading fails critically
            // mainWindow.removeBrowserView(view);
            // views.delete(id);
            // view.webContents.destroy();
        });
        // console.log(`[CreateView] View ${id} created and mapped.`);
        return id;
    } catch (error) {
        console.error(`[CreateView] Error during BrowserView creation for id ${id}:`, error);
        return null;
    }
});

ipcMain.on('update-view-bounds', (event, { id, bounds }) => {
    const view = views.get(id);
    if (view instanceof BrowserView) {
        if (!view.isDestroyed()) {
            if (mainWindow) { // Ensure mainWindow still exists
                const validatedBounds = {
                    x: Math.round(bounds.x),
                    y: Math.round(bounds.y),
                    width: Math.max(1, Math.round(bounds.width)),
                    height: Math.max(1, Math.round(bounds.height))
                };
                view.setBounds(validatedBounds);
            } else {
                console.warn(`[UpdateViewBounds] mainWindow not available for view ${id}.`);
            }
        } else {
            // console.log(`[UpdateViewBounds] View ${id} is already destroyed. Cannot update bounds.`);
        }
    } else {
        console.warn(`[UpdateViewBounds] No valid BrowserView found for id ${id}. Found:`, view);
    }
});

ipcMain.on('remove-view', (event, id) => {
    const view = views.get(id);
    if (view instanceof BrowserView) {
        if (mainWindow && !view.isDestroyed()) { // Check mainWindow as removeBrowserView needs it
            mainWindow.removeBrowserView(view);
        }
        // Always try to destroy webContents if view exists, even if mainWindow is gone or view was already "destroyed" by Electron's standards
        if (!view.webContents.isDestroyed()) { // Check webContents destruction specifically
            view.webContents.destroy();
        }
        views.delete(id);
        // console.log(`[RemoveView] View ${id} processed for removal.`);
    } else {
        console.warn(`[RemoveView] No valid BrowserView found for id ${id} to remove. Found:`, view);
    }
});

ipcMain.on('navigate-view', (event, { id, action, url }) => {
    const view = views.get(id);
    if (view instanceof BrowserView) {
        if (!view.isDestroyed()) {
            const contents = view.webContents;
            if (action === 'loadURL' && url) {
                contents.loadURL(url).catch(err => console.error(`[NavigateView] Failed to load URL ${url} for view ${id}:`, err));
            } else if (action === 'goBack' && contents.canGoBack()) {
                contents.goBack();
            } else if (action === 'goForward' && contents.canGoForward()) {
                contents.goForward();
            } else if (action === 'reload') {
                contents.reload();
            }
        } else {
            // console.log(`[NavigateView] View ${id} is already destroyed. Cannot navigate.`);
        }
    } else {
        console.warn(`[NavigateView] No valid BrowserView found for id ${id}. Found:`, view);
    }
});

ipcMain.on('focus-view', (event, id) => {
    const view = views.get(id);
    // This is likely the area of your error (around line 110)
    if (view instanceof BrowserView) {
        if (!view.isDestroyed()) {
            // console.log(`[FocusView] Focusing view ${id}.`) // For debugging
            view.webContents.focus();
        } else {
            // console.log(`[FocusView] View ${id} is already destroyed. Cannot focus.`);
        }
    } else {
        console.warn(`[FocusView] No valid BrowserView found for id ${id} to focus. Found:`, view);
        // If the error was "view.isDestroyed is not a function", then 'view' was truthy but not a BrowserView.
        // This log will show what 'view' actually was.
    }
});
