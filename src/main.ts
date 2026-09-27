import { app, BrowserWindow, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1b1b1e',
    title: 'SuperSLM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

ipcMain.handle('app:info', () => ({
  appVersion: app.getVersion(),
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
}));

ipcMain.handle('app:changelog', () =>
  readFile(path.join(app.getAppPath(), 'docs', 'CHANGELOG.md'), 'utf8')
);

void app.whenReady().then(() => {
  app.setName('SuperSLM');
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
