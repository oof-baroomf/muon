const { app, BrowserWindow, BrowserView, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
// Store stateful objects: { id: { view: BrowserView, status: 'loading'|'active'|'crashed'|'removing', url: string } }
const viewInstances = new Map();

// --- Centralized and Defensive Cleanup Function ---
function safeDestroyView(viewId, reason) {
    console.log(`[SafeDestroy - ${viewId}] Initiated. Reason: ${reason}`);
    const viewState = viewInstances.get(viewId);

    if (!viewState || viewState.status === 'removing') {
        if (viewState) console.log(`[SafeDestroy - ${viewId}] View already being removed or gone from map.`);
        else console.log(`[SafeDestroy - ${viewId}] View not found in map.`);
        viewInstances.delete(viewId); // Ensure it's deleted if somehow still present
        return;
    }

    viewState.status = 'removing'; // Mark as 'removing' to prevent re-entrant operations

    const browserView = viewState.view;

    if (browserView) {
        // Remove from mainWindow first
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                // Check if isDestroyed method exists before calling
                if (typeof browserView.isDestroyed === 'function') {
                    if (!browserView.isDestroyed()) {
                        console.log(`[SafeDestroy - ${viewId}] Removing BrowserView from mainWindow.`);
                        mainWindow.removeBrowserView(browserView);
                    } else {
                        console.log(`[SafeDestroy - ${viewId}] BrowserView already reported as destroyed (by isDestroyed()).`);
                    }
                } else {
                    console.warn(`[SafeDestroy - ${viewId}] browserView.isDestroyed is not a function. Attempting removal from window cautiously.`);
                    mainWindow.removeBrowserView(browserView);
                }
            } catch (e) {
                console.error(`[SafeDestroy - ${viewId}] Error removing BrowserView from mainWindow:`, e);
            }
        }

        // Destroy webContents
        if (browserView.webContents) {
            try {
                if (typeof browserView.webContents.isDestroyed === 'function') {
                    if (!browserView.webContents.isDestroyed()) {
                        console.log(`[SafeDestroy - ${viewId}] Destroying webContents.`);
                        browserView.webContents.destroy();
                    } else {
                        console.log(`[SafeDestroy - ${viewId}] WebContents already reported as destroyed.`);
                    }
                } else {
                     console.warn(`[SafeDestroy - ${viewId}] browserView.webContents.isDestroyed is not a function.`);
                     browserView.webContents.destroy();
                }
            } catch (e) {
                console.error(`[SafeDestroy - ${viewId}] Error destroying webContents:`, e);
            }
        } else {
             console.warn(`[SafeDestroy - ${viewId}] No webContents found on BrowserView to destroy.`);
        }
    }

    viewInstances.delete(viewId);
    console.log(`[SafeDestroy - ${viewId}] View fully removed from 'viewInstances' map.`);

    // Inform renderer
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('view-crashed-or-removed', viewId);
    }
}

// --- Main Window Creation ---
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
        console.log('[MainWindowEvent] Main window closed. Destroying all views.');
        const viewIdsToDestroy = Array.from(viewInstances.keys());
        viewIdsToDestroy.forEach(vid => {
            safeDestroyView(vid, 'mainWindow closed');
        });
        mainWindow = null;
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

// Bypass certificate errors for debugging (REMOVE FOR PRODUCTION)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.warn(`[CertificateError] URL: ${url}, Error: ${error}. Allowing (DEBUG ONLY).`);
    event.preventDefault();
    callback(true);
});

// --- IPC Handlers ---

ipcMain.handle('create-view', async (event, { id, url }) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        console.error('[CreateView] mainWindow is not available or destroyed.');
        return null;
    }
    if (viewInstances.has(id)) {
        console.warn(`[CreateView] View with ID ${id} already exists. Forcing cleanup of old one.`);
        safeDestroyView(id, 'duplicate ID creation attempt');
    }

    let newBrowserViewObject;
    try {
        newBrowserViewObject = new BrowserView({
            webPreferences: { contextIsolation: true, nodeIntegration: false }
        });
        console.log(`[CreateView - ${id}] New BrowserView JS object created.`);

        viewInstances.set(id, { view: newBrowserViewObject, status: 'loading', url: url });
        console.log(`[CreateView - ${id}] View added to map with 'loading' status.`);

        mainWindow.addBrowserView(newBrowserViewObject);
        newBrowserViewObject.setBounds({ x: -20000, y: -20000, width: 1, height: 1 });
        newBrowserViewObject.setBackgroundColor('#2C2C2C');

        const wc = newBrowserViewObject.webContents;

        const didFinishLoadHandler = () => {
            console.log(`[WebContentsEvent - ${id}] did-finish-load: ${wc.getURL()}`);
            const currentViewState = viewInstances.get(id);
            if (currentViewState && currentViewState.status === 'loading') {
                currentViewState.status = 'active';
                console.log(`[WebContentsEvent - ${id}] View status updated to 'active'.`);
                if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                    mainWindow.webContents.send('view-ready-for-bounds', id);
                }
            }
            wc.removeListener('did-fail-load', didFailLoadHandler);
        };

        const didFailLoadHandler = (evt, errorCode, errorDescription, validatedURL) => {
            console.error(`[WebContentsEvent - ${id}] did-fail-load: ${validatedURL}, Code: ${errorCode}, Desc: ${errorDescription}`);
            safeDestroyView(id, `did-fail-load: ${errorDescription}`);
            wc.removeListener('did-finish-load', didFinishLoadHandler);
        };

        const renderProcessGoneHandler = (evt, details) => {
            console.error(`[WebContentsEvent - ${id}] !!! RENDER PROCESS GONE: ${wc.getURL()}, Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
            safeDestroyView(id, `render-process-gone: ${details.reason}`);
        };
        
        wc.once('did-finish-load', didFinishLoadHandler);
        wc.once('did-fail-load', didFailLoadHandler);
        wc.on('render-process-gone', renderProcessGoneHandler);

        console.log(`[CreateView - ${id}] Attempting to load URL: ${url}`);
        await wc.loadURL(url);
        console.log(`[CreateView - ${id}] wc.loadURL() called for ${url}. Event listeners will handle outcome.`);
        
        return id;
    } catch (error) {
        console.error(`[CreateView - ${id}] CRITICAL ERROR during BrowserView instantiation or initial wc.loadURL() call:`, error);
        if (newBrowserViewObject) {
            safeDestroyView(id, 'error in create-view catch block');
        } else if (viewInstances.has(id)) {
            safeDestroyView(id, 'error in create-view catch block, map entry existed');
        }
        return null;
    }
});

ipcMain.on('update-view-bounds', (event, { id, bounds }) => {
    const viewState = viewInstances.get(id);
    if (viewState && viewState.view && viewState.status === 'active') {
        const browserView = viewState.view;
        if (browserView instanceof BrowserView && typeof browserView.isDestroyed === 'function' && typeof browserView.setBounds === 'function') {
            if (!browserView.isDestroyed()) {
                const validatedBounds = {
                    x: Math.round(bounds.x), y: Math.round(bounds.y),
                    width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height))
                };
                browserView.setBounds(validatedBounds);
            } else {
                console.warn(`[UpdateBounds - ${id}] View reported destroyed by isDestroyed(). Cleaning up.`);
                safeDestroyView(id, 'update-view-bounds on destroyed view');
            }
        } else {
            console.error(`[UpdateBounds - ${id}] View object is invalid (not BrowserView or methods missing). State: ${JSON.stringify(viewState)}. Cleaning up.`);
            safeDestroyView(id, 'update-view-bounds on invalid view object');
        }
    }
});

ipcMain.on('focus-view', (event, id) => {
    process.nextTick(() => {
        const viewState = viewInstances.get(id);
        if (viewState && viewState.view && viewState.status === 'active') {
            const browserView = viewState.view;
            if (
                browserView instanceof BrowserView &&
                typeof browserView.isDestroyed === 'function' &&
                browserView.webContents &&
                typeof browserView.webContents.focus === 'function' &&
                typeof browserView.webContents.isDestroyed === 'function'
            ) {
                if (!browserView.isDestroyed() && !browserView.webContents.isDestroyed()) {
                    console.log(`[FocusView - ${id}] Attempting to focus webContents.`);
                    browserView.webContents.focus();
                } else {
                    console.warn(`[FocusView - ${id}] View or webContents reported destroyed. Cleaning up.`);
                    safeDestroyView(id, 'focus-view on destroyed view/wc');
                }
            } else {
                console.error(`[FocusView - ${id}] View object or webContents methods invalid/missing. State: ${JSON.stringify(viewState)}. Cleaning up.`);
                safeDestroyView(id, 'focus-view on invalid view object or wc');
            }
        }
    });
});

ipcMain.on('navigate-view', (event, { id, action, url }) => {
    const viewState = viewInstances.get(id);
    if (viewState && viewState.view && viewState.status === 'active') {
        const browserView = viewState.view;
        if (browserView instanceof BrowserView && typeof browserView.isDestroyed === 'function' && !browserView.isDestroyed() && browserView.webContents) {
            const contents = browserView.webContents;
            if (action === 'goBack' && typeof contents.goBack === 'function' && contents.canGoBack()) {
                contents.goBack();
            } else if (action === 'goForward' && typeof contents.goForward === 'function' && contents.canGoForward()) {
                contents.goForward();
            } else if (action === 'reload' && typeof contents.reload === 'function') {
                contents.reload();
            } else if (action === 'loadURL' && url && typeof contents.loadURL === 'function') {
                contents.loadURL(url).catch(err => console.error(`[NavigateView] Failed to load URL ${url} for view ${id}:`, err));
            }
        } else {
            console.error(`[NavigateView - ${id}] View object invalid or destroyed. Cleaning up.`);
            safeDestroyView(id, 'navigate-view on invalid/destroyed view');
        }
    }
});

ipcMain.on('remove-view', (event, id) => {
    console.log(`[RemoveView - ${id}] Explicit removal requested by renderer.`);
    safeDestroyView(id, 'renderer requested removal');
});
