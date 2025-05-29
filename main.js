const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let browserView;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#1e1e1e'
    });

    mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

    mainWindow.webContents.on('did-finish-load', () => {
        browserView = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
            }
        });
        mainWindow.setBrowserView(browserView);

        const [width, height] = mainWindow.getContentSize();
        const toolbarHeight = 50;
        browserView.setBounds({ x: 0, y: toolbarHeight, width: width, height: height - toolbarHeight });
        browserView.setAutoResize({ width: true, height: true });
    });

    mainWindow.on('resize', () => {
        if (browserView) {
            const [width, height] = mainWindow.getContentSize();
            const toolbarHeight = 50;
            browserView.setBounds({ x: 0, y: toolbarHeight, width: width, height: height - toolbarHeight });
        }
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

ipcMain.on('load-url', (event, url) => {
    if (browserView) {
        let targetUrl = url;
        try {
            new URL(url);
        } catch (_) {
            targetUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        browserView.webContents.loadURL(targetUrl);
    }
});

ipcMain.on('go-back', () => {
    if (browserView && browserView.webContents.canGoBack()) {
        browserView.webContents.goBack();
    }
});

ipcMain.on('set-zoom', (event, factor) => {
    if (browserView) {
        browserView.webContents.setZoomFactor(factor);
    }
});

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
});
