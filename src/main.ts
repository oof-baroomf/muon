 // These are injected by @electron-forge/plugin-webpack
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;

import path from 'path';
import { app, BrowserWindow, ipcMain, IpcMainEvent, WebContentsView, Menu, MenuItemConstructorOptions } from 'electron';
import type { Rectangle } from 'electron';
import fs from 'fs';
import os from 'os';
import { loadConfig, AppConfig, getConfigPath } from './config';
import type { DesktopState } from './renderer/state';

const views = new Map<string, WebContentsView>();

let mainWindow: BrowserWindow | null = null;
let appConfig: AppConfig = loadConfig();
let settingsWindow: BrowserWindow | null = null;

const tempRoot = path.join(os.tmpdir(), 'muon');
fs.mkdirSync(tempRoot, { recursive: true });
process.env.TMPDIR = tempRoot;

// Headless/dev environments struggle with Chromium's GPU process; disable it up front.
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.disableHardwareAcceleration();

function createMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => openSettingsWindow() },
          { type: 'separator' },
          { role: 'quit' }
        ]
      } as MenuItemConstructorOptions
    ] : []),
    {
      label: 'File',
      submenu: [
        ...(isMac ? [] : [{ label: 'Settings...', accelerator: 'Ctrl+,', click: () => openSettingsWindow() }, { type: 'separator' }]),
        { role: isMac ? 'close' : 'quit' }
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ] as MenuItemConstructorOptions[];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow () {
  mainWindow = new BrowserWindow({
    width: appConfig.mainWindow.width,
    height: appConfig.mainWindow.height,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: true,
      contextIsolation: true
    }
  });

  // works in both dev (http://localhost:300x) and prod (file://…)
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.on('closed', () => { mainWindow = null; });
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: appConfig.settingsWindow.width,
    height: appConfig.settingsWindow.height,
    resizable: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: true,
      contextIsolation: true
    }
  });
  settingsWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY);
  settingsWindow.on('closed', () => { settingsWindow = null; });
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

ipcMain.handle('config:load', () => {
  return appConfig;
});

ipcMain.handle('config:path', () => getConfigPath());

const notesDir = path.join(app.getPath('userData'), 'notes');
if (!fs.existsSync(notesDir)) {
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(path.join(notesDir, 'welcome.md'), '# Welcome to Muon\n');
}

function resolveNotePath(notePath: string): string {
  const full = path.resolve(notesDir, notePath);
  if (!full.startsWith(notesDir + path.sep) && full !== notesDir) {
    throw new Error('Invalid note path');
  }
  return full;
}

ipcMain.handle('note:read', async (_evt, notePath: string) => {
  const full = resolveNotePath(notePath);
  try {
    return fs.readFileSync(full, 'utf-8');
  } catch {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
    return '';
  }
});

ipcMain.on('note:write', (_evt, notePath: string, content: string) => {
  const full = resolveNotePath(notePath);
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

  const send = (channel: string, ...args: unknown[]) => {
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

ipcMain.on('view:set-bounds', (evt, id: string, bounds: Rectangle) => {
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

ipcMain.on('overlay:show', () => {
  for (const view of views.values()) {
    view.setVisible(false);
  }
});

ipcMain.on('overlay:hide', () => {
  for (const view of views.values()) {
    view.setVisible(true);
  }
});

app.whenReady().then(() => {
  app.setPath('temp', tempRoot);

  createMainWindow();
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createMainWindow();
});
