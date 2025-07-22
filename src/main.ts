 // These are injected by @electron-forge/plugin-webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import path from 'path';
import { app, BrowserWindow, ipcMain, IpcMainEvent, WebContentsView } from 'electron';
import fs from 'fs';

const views = new Map<string, WebContentsView>();

interface WindowState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  notePath?: string;
}

interface DesktopState {
  windows: WindowState[];
  transform: { scale: number; x: number; y: number };
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow () {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: true,
    }
  });

  // works in both dev (http://localhost:300x) and prod (file://…)
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.on('closed', () => { mainWindow = null; });
}

const statePath = path.join(app.getPath('userData'), 'state.json');

ipcMain.handle('state:load', async () => {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')) as DesktopState;
  } catch {
    return { windows: [], transform: { scale: 1, x: 0, y: 0 } } as DesktopState;
  }
});

ipcMain.on('state:save', (_evt: IpcMainEvent, data: DesktopState) => {
  fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
});

const notesDir = path.join(app.getPath('userData'), 'notes');

ipcMain.handle('note:read', async (_evt, notePath: string) => {
  const full = path.join(notesDir, notePath);
  try {
    return fs.readFileSync(full, 'utf-8');
  } catch {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
    return '';
  }
});

ipcMain.on('note:write', (_evt, notePath: string, content: string) => {
  const full = path.join(notesDir, notePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
});

ipcMain.on('view:create', (evt, id: string, url: string) => {
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      partition: `persist:muon`
    }
  });
  if (mainWindow) {
    (mainWindow.contentView as any).addChildView(view);
  }
  view.setBackgroundColor("#00000000");
  views.set(id, view);
  view.webContents.loadURL(url);

  const send = (channel: string, ...args: any[]) => {
    const wc = evt.sender;
    if (!wc.isDestroyed()) {
      wc.send(channel, ...args);
    }
  }

  view.webContents.on('did-navigate', () => {
    send(`view:did-navigate:${id}`, view.webContents.getURL());
  });
  view.webContents.on('did-navigate-in-page', () => {
    send(`view:did-navigate-in-page:${id}`, view.webContents.getURL());
  });
  view.webContents.on('page-title-updated', () => {
    send(`view:page-title-updated:${id}`, view.webContents.getTitle());
  });
});

ipcMain.on('view:destroy', (evt, id: string) => {
  const view = views.get(id);
  if (view) {
    if (mainWindow) {
      (mainWindow.contentView as any).removeChildView(view);
    }
    (view.webContents as any).destroy();
    views.delete(id);
  }
});

ipcMain.on('view:set-bounds', (evt, id: string, bounds: Electron.Rectangle) => {
  const view = views.get(id);
  if (view) {
    view.setBounds(bounds);
  }
});

ipcMain.on('view:back', (evt, id: string) => {
  const view = views.get(id);
  if (view && view.webContents.canGoBack()) {
    view.webContents.goBack();
  }
});

ipcMain.on('view:forward', (evt, id: string) => {
  const view = views.get(id);
  if (view && view.webContents.canGoForward()) {
    view.webContents.goForward();
  }
});

ipcMain.on('view:reload', (evt, id: string) => {
  const view = views.get(id);
  if (view) {
    view.webContents.reload();
  }
});

ipcMain.on('view:stop', (evt, id: string) => {
  const view = views.get(id);
  if (view) {
    view.webContents.stop();
  }
});

ipcMain.on('view:load-url', (evt, id: string, url: string) => {
  const view = views.get(id);
  if (view) {
    view.webContents.loadURL(url);
  }
});

ipcMain.on('view:set-zoom-factor', (evt, id: string, factor: number) => {
  const view = views.get(id);
  if (view) {
    view.webContents.setZoomFactor(factor);
  }
});

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});
