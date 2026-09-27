import { app, BrowserWindow, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SuperslmSettings } from './settings';
import { ensureStorage, loadSettings, patchSettings, THEME_BG } from './settings';

const HF_API = 'https://huggingface.co/api/models';
const HF_LIMIT = '24';
const HF_MAX_SEARCH_LEN = 200;
const MODEL_SORTS = new Set(['likes', 'downloads']);

interface HfModel {
  id: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  pipeline_tag?: string;
}

async function createWindow(): Promise<void> {
  const settings = await loadSettings();
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    fullscreen: settings.fullscreen,
    backgroundColor: THEME_BG[settings.theme] ?? THEME_BG.dark,
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    title: 'SuperSLM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  void win.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'index.html'));
  if (settings.devtools) win.webContents.openDevTools({ mode: 'detach' });
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

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:patch', (_event, patch: Partial<SuperslmSettings>) =>
  patchSettings(patch)
);

ipcMain.handle('window:fullscreen', (event, flag: unknown) => {
  BrowserWindow.fromWebContents(event.sender)?.setFullScreen(flag === true);
});

ipcMain.handle('window:devtools', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.openDevTools({ mode: 'detach' });
});

ipcMain.handle('models:list', async (_event, search: unknown, sort: unknown) => {
  const params = new URLSearchParams({
    filter: 'text-generation',
    sort: typeof sort === 'string' && MODEL_SORTS.has(sort) ? sort : 'likes',
    direction: '-1',
    limit: HF_LIMIT
  });
  if (typeof search === 'string' && search.trim()) {
    params.set('search', search.trim().slice(0, HF_MAX_SEARCH_LEN));
  }
  const res = await fetch(`${HF_API}?${params}`);
  if (!res.ok) throw new Error(`Hugging Face request failed: ${res.status}`);
  const models = (await res.json()) as HfModel[];
  return models.map((m) => ({
    id: m.id,
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    pipeline: m.pipeline_tag ?? '',
    updated: m.lastModified ?? ''
  }));
});

void app.whenReady().then(async () => {
  app.setName('SuperSLM');
  app.setAppUserModelId('com.superslm.app');
  await ensureStorage();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
