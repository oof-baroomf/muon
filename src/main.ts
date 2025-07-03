 // These are injected by @electron-forge/plugin-webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

import path from 'path';
import { app, BrowserWindow, ipcMain, IpcMainEvent, webContents } from 'electron';
import fs from 'fs';

interface WindowState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  title?: string;
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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true
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


app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});
