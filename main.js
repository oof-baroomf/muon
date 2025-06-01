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

// Global view state tracker
const viewStates = new Map();

ipcMain.handle('create-view', async (event, { id, url }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.error('[CreateView] mainWindow is not available or destroyed.');
        return null;
    }

    // Check for existing view with same ID
    if (views.has(id)) {
        console.warn(`[CreateView] View with id ${id} already exists. Cleaning up old view.`);
        const oldView = views.get(id);
        if (oldView && !oldView.isDestroyed()) {
            try {
                mainWindow.removeBrowserView(oldView);
                if (oldView.webContents && !oldView.webContents.isDestroyed()) {
                    oldView.webContents.destroy();
                }
            } catch (e) {
                console.error(`[CreateView] Error cleaning up old view ${id}:`, e);
            }
        }
        views.delete(id);
    }

    let view;
    try {
        view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
                partition: `persist:view_${id}`,
                webSecurity: true,
                allowRunningInsecureContent: false
            }
        });

        // Track view state
        viewStates.set(id, {
            creationTime: Date.now(),
            lastActivity: Date.now(),
            crashCount: 0
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
            console.error(`[WebContentsEvent - ${id}] !!! RENDER PROCESS GONE: ${wc.getURL()}, Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
            
            const viewToRemove = views.get(id); // Get a reference before deleting from map

            // IMPORTANT: Remove from our tracking map immediately
            if (views.has(id)) {
                views.delete(id);
                console.log(`[RenderProcessGoneCleanup - ${id}] View REMOVED from 'views' map.`);
            } else {
                 console.warn(`[RenderProcessGoneCleanup - ${id}] View ID was NOT IN 'views' map at time of cleanup.`);
            }

            // Attempt to remove and destroy the BrowserView from main window using the retrieved reference
            if (mainWindow && viewToRemove && typeof viewToRemove.isDestroyed === 'function' && !viewToRemove.isDestroyed()) {
                try {
                    console.log(`[RenderProcessGoneCleanup - ${id}] Attempting to remove BrowserView from mainWindow.`);
                    mainWindow.removeBrowserView(viewToRemove);
                } catch (e) {
                    console.error(`[RenderProcessGoneCleanup - ${id}] Error removing BrowserView from mainWindow: `, e);
                }
            }

            // Attempt to destroy webContents explicitly if it's not already
            if (viewToRemove && viewToRemove.webContents && typeof viewToRemove.webContents.isDestroyed === 'function' && !viewToRemove.webContents.isDestroyed()) {
                 try {
                    console.log(`[RenderProcessGoneCleanup - ${id}] Attempting to destroy webContents.`);
                    viewToRemove.webContents.destroy();
                } catch (e) {
                    console.error(`[RenderProcessGoneCleanup - ${id}] Error destroying webContents: `, e);
                }
            }
            
            // Inform renderer UI that the view is gone
            if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('view-crashed', {
                    id,
                    url: wc.getURL(),
                    crashCount: (viewStates.get(id)?.crashCount || 0) + 1,
                    reason: details.reason
                });
            }

            // Auto-recover if crash count < 3
            const state = viewStates.get(id) || {};
            state.crashCount = (state.crashCount || 0) + 1;
            viewStates.set(id, state);
            
            if (state.crashCount < 3) {
                console.log(`[CrashRecovery] Attempting to recreate view ${id} (attempt ${state.crashCount})`);
                setTimeout(() => {
                    event.sender.send('recreate-view', id);
                }, 1000);
            }
        });

        console.log(`[CreateView - ${id}] Attempting to load URL: ${url}`);
        await wc.loadURL(url);
        console.log(`[CreateView - ${id}] loadURL call completed for: ${url}`);

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

    process.nextTick(() => {
        console.log(`[Main - FocusView - NextTick] Executing deferred focus logic for ${id}.`);
        const view = views.get(id);

        if (!view) {
            console.log(`[Main - FocusView - NextTick - Info] View with id ${id} NOT FOUND in views map. This is the expected path if render-process-gone cleaned it up.`);
            return;
        }
        console.log(`[Main - FocusView - NextTick - Check 1] View ${id} retrieved from map. Type: ${typeof view}`);

        // Primary Guard: Check for a functional BrowserView JS object
        if (
            !(view instanceof BrowserView) ||
            typeof view.isDestroyed !== 'function' ||
            typeof view.webContents !== 'object' ||
            (view.webContents && typeof view.webContents.isDestroyed !== 'function') ||
            Object.keys(view).length === 0
        ) {
            console.warn(`[Main - FocusView - NextTick - Warning] View ${id} (instanceof BrowserView: ${view instanceof BrowserView}) appears to be an incomplete or gutted JS object. typeof isDestroyed: ${typeof view.isDestroyed}, typeof webContents: ${typeof view.webContents}, Object.keys.length: ${Object.keys(view).length}. Assuming it's unusable.`);
            
            views.delete(id);
            return;
        }
        console.log(`[Main - FocusView - NextTick - Check 2] View ${id} appears to be a sufficiently complete BrowserView JS object.`);

        try {
            if (view.isDestroyed()) {
                console.warn(`[Main - FocusView - NextTick - Info] View ${id} IS ALREADY DESTROYED (reported by isDestroyed). Removing from map.`);
                views.delete(id);
                return;
            }
            console.log(`[Main - FocusView - NextTick - Check 4b] View ${id} is not destroyed.`);

            if (view.webContents.isDestroyed()) {
                console.warn(`[Main - FocusView - NextTick - Info] View ${id} webContents IS DESTROYED. Removing from map.`);
                views.delete(id);
                return;
            }
            console.log(`[Main - FocusView - NextTick - Check 8b] View ${id} webContents is not destroyed.`);

            console.log(`[Main - FocusView - NextTick - Check 10] ATTEMPTING to call webContents.focus() for view ${id}.`);
            view.webContents.focus();
            console.log(`[Main - FocusView - NextTick - Check 11] SUCCESSFULLY CALLED webContents.focus() for view ${id}.`);

        } catch (e) {
            console.error(`[Main - FocusView - NextTick] !!! JS EXCEPTION during view/webContents operations for ${id} (after initial checks passed):`, e);
            views.delete(id);
        }
    });
});
