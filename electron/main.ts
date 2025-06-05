import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadURL(
    process.env.VITE_DEV_SERVER_URL ??
      `file://${path.join(__dirname, '../renderer/dist/index.html')}`
  );
};

app.whenReady().then(async () => {
  app.on('before-quit', () => session.defaultSession.cookies.flushStore());
  createWindow();
});
