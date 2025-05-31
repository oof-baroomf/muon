const { app, BrowserWindow, BrowserView, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
const views = new Map();

// Handle SSL certificate errors (for debugging only)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.warn(`[CertificateError] URL: ${url}, Error: ${error}`);
    event.preventDefault();
    callback(true);
});

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
    mainWindow.webContents.openDevTools();

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

ipcMain.handle('create-view', async (event, { id, url }) => {
    if (!mainWindow) {
        console.error('[CreateView] mainWindow is not available.');
        return null;
    }

    let view;
    try {
        view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
                partition: `persist:view_${id}`
            }
        });
        mainWindow.addBrowserView(view);
        views.set(id, view);

        view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
        view.setBackgroundColor('#FFFFFF');

        const wc = view.webContents;

        wc.on('did-finish-load', () => {
            console.log(`[WebContentsEvent - ${id}] did-finish-load: ${wc.getURL()}`);
        });
        wc.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error(`[WebContentsEvent - ${id}] did-fail-load: ${validatedURL}, Error: ${errorCode}, ${errorDescription}`);
        });
        wc.on('did-stop-loading', () => {
            console.log(`[WebContentsEvent - ${id}] did-stop-loading: ${wc.getURL()}`);
        });
        wc.on('unresponsive', () => {
            console.warn(`[WebContentsEvent - ${id}] WebContents became unresponsive: ${wc.getURL()}`);
        });
        wc.on('render-process-gone', (event, details) => {
            console.error(`[WebContentsEvent - ${id}] Render process gone: ${wc.getURL()}, Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
            if (views.has(id)) {
                if (mainWindow && !view.isDestroyed()) {
                    try {
                        mainWindow.removeBrowserView(view);
                    } catch (e) {
                        console.error(`[RenderProcessGoneCleanup - ${id}] Error removing BrowserView: `, e);
                    }
                }
                views.delete(id);
                if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('view-crashed', id);
                }
            }
        });

        console.log(`[CreateView - ${id}] Attempting to load URL: ${url}`);
        await wc.loadURL(url);
        console.log(`[CreateView - ${id}] loadURL call completed for: ${url}`);
        view.webContents.openDevTools({ mode: 'detach' }); // For debugging individual views

        return id;
    } catch (error) {
        console.error(`[CreateView - ${id}] Error during BrowserView creation or initial load:`, error);
        if (view && mainWindow && views.has(id)) {
            if (!view.isDestroyed()) {
                try { mainWindow.removeBrowserView(view); } catch(e) { /* ignore */ }
            }
            views.delete(id);
        }
        if (view && view.webContents && !view.webContents.isDestroyed()){
            try { view.webContents.destroy(); } catch(e) { /* ignore */ }
        }
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
            console.log(`[UpdateViewBounds] View ${id} is already destroyed. Cannot update bounds.`);
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
        console.log(`[RemoveView] View ${id} processed for removal.`);
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
            console.log(`[NavigateView] View ${id} is already destroyed. Cannot navigate.`);
        }
    } else {
        console.warn(`[NavigateView] No valid BrowserView found for id ${id}. Found:`, view);
    }
});

ipcMain.on('focus-view', (event, id) => {
    console.log(`[Main - FocusViewAttempt] Received request to focus view ${id}.`);
    const view = views.get(id);

    if (!view) {
        console.error(`[Main - FocusView] CRITICAL: View with id ${id} NOT FOUND in views map at time of focus request.`);
        return;
    }

    if (!(view instanceof BrowserView)) {
        console.error(`[Main - FocusView] CRITICAL: Item with id ${id} found in views map IS NOT an instance of BrowserView. Type: ${typeof view}, Value:`, view);
        return;
    }

    console.log(`[Main - FocusView] View ${id} is an instance of BrowserView.`);

    if (view.isDestroyed()) {
        console.warn(`[Main - FocusView] View ${id} IS ALREADY DESTROYED (native object). Cannot focus.`);
        return;
    }
    console.log(`[Main - FocusView] View ${id} is not destroyed (native object check passed).`);

    if (!view.webContents) {
        console.error(`[Main - FocusView] CRITICAL: View ${id} has NO webContents property. This should not happen for a valid BrowserView.`);
        return;
    }
    console.log(`[Main - FocusView] View ${id} has a webContents property.`);

    if (view.webContents.isDestroyed()) {
        console.warn(`[Main - FocusView] View ${id} webContents IS DESTROYED (webContents specific). Cannot focus.`);
        return;
    }
    console.log(`[Main - FocusView] View ${id} webContents is not destroyed.`);

    try {
        console.log(`[Main - FocusView] Attempting to call webContents.focus() for view ${id}.`);
        view.webContents.focus();
        console.log(`[Main - FocusView] Successfully CALLED webContents.focus() for view ${id}. (This does not guarantee focus was acquired by OS).`);
    } catch (error) {
        console.error(`[Main - FocusView] !!! EXCEPTION DURING webContents.focus() CALL for view ${id}:`, error);
    }
});
