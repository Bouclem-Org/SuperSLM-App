import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { getBackendStatus, startBackend, stopBackend } from './llamacpp';
import type { SuperslmSettings } from './settings';
import { ensureStorage, loadSettings, patchSettings, THEME_BG } from './settings';

const HF_API = 'https://huggingface.co/api/models';
const HF_LIMIT = '24';
const HF_MAX_SEARCH_LEN = 200;
const HF_README_MAX = 60000;
const MODEL_SORTS = new Set(['likes', 'downloads']);
const PROGRESS_STEP = 1024 * 1024;

interface HfModel {
  id: string;
  author?: string;
  downloads?: number;
  likes?: number;
  lastModified?: string;
  pipeline_tag?: string;
  library_name?: string;
  tags?: string[];
  siblings?: { rfilename: string }[];
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

ipcMain.handle('dialog:pickGguf', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a GGUF model',
    filters: [{ name: 'GGUF model', extensions: ['gguf'] }],
    properties: ['openFile']
  });
  const file = res.filePaths[0];
  if (res.canceled || !file) return null;
  await patchSettings({ modelFile: file });
  return file;
});

ipcMain.handle('window:fullscreen', (event, flag: unknown) => {
  BrowserWindow.fromWebContents(event.sender)?.setFullScreen(flag === true);
});

ipcMain.handle('window:devtools', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.openDevTools({ mode: 'detach' });
});

const hfJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hugging Face request failed: ${res.status}`);
  return res.json();
};

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
  const models = (await hfJson(`${HF_API}?${params}`)) as HfModel[];
  return models.map((m) => ({
    id: m.id,
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    pipeline: m.pipeline_tag ?? '',
    updated: m.lastModified ?? ''
  }));
});

ipcMain.handle('models:detail', async (_event, id: unknown) => {
  if (typeof id !== 'string' || !id.includes('/') || id.includes('..')) {
    throw new Error('Invalid model id');
  }
  const m = (await hfJson(`${HF_API}/${id}`)) as HfModel;

  let readme: string | null = null;
  let readmeTruncated = false;
  const res = await fetch(`https://huggingface.co/${id}/raw/main/README.md`);
  if (res.ok) {
    const raw = await res.text();
    if (raw.length > HF_README_MAX) {
      const cut = raw.lastIndexOf('\n\n', HF_README_MAX);
      readme = raw.slice(0, cut > HF_README_MAX / 2 ? cut : HF_README_MAX).trimEnd();
      readmeTruncated = true;
    } else {
      readme = raw;
    }
  }

  const ggufs = (m.siblings ?? [])
    .map((s) => s.rfilename)
    .filter((f) => f.toLowerCase().endsWith('.gguf'))
    .slice(0, 10);

  const files = await Promise.all(
    ggufs.map(async (name) => {
      try {
        const head = await fetch(`https://huggingface.co/${id}/resolve/main/${name}`, {
          method: 'HEAD'
        });
        const size = Number(head.headers.get('x-linked-size') ?? head.headers.get('content-length'));
        return { name, size: Number.isFinite(size) && size > 0 ? size : null };
      } catch {
        return { name, size: null };
      }
    })
  );

  return {
    id: m.id,
    author: m.author ?? id.split('/')[0],
    pipeline: m.pipeline_tag ?? '',
    library: m.library_name ?? '',
    downloads: m.downloads ?? 0,
    likes: m.likes ?? 0,
    updated: m.lastModified ?? '',
    tags: (m.tags ?? []).slice(0, 8),
    readme,
    readmeTruncated,
    files
  };
});

ipcMain.handle('models:download', async (event, modelId: unknown, file: unknown) => {
  if (
    typeof modelId !== 'string' ||
    !modelId.includes('/') ||
    modelId.includes('..') ||
    typeof file !== 'string' ||
    file.includes('..') ||
    file.includes('/')
  ) {
    throw new Error('Bad download request');
  }

  const settings = await loadSettings();
  const win = BrowserWindow.fromWebContents(event.sender);
  if (settings.confirmDownload && win) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Cancel', 'Download'],
      defaultId: 1,
      cancelId: 0,
      title: 'Download model',
      message: `Download ${file}?`,
      detail: `${modelId} → ~/.superslm/models/${modelId}/`
    });
    if (response !== 1) return { cancelled: true };
  }

  const destDir = path.join(homedir(), '.superslm', 'models', modelId);
  await mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, file);

  const res = await fetch(`https://huggingface.co/${modelId}/resolve/main/${file}`);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  const total = Number(res.headers.get('x-linked-size') ?? res.headers.get('content-length') ?? 0);

  let received = 0;
  let lastSent = 0;
  const counter = new PassThrough();
  counter.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (received - lastSent >= PROGRESS_STEP) {
      lastSent = received;
      event.sender.send('models:progress', { file, received, total });
    }
  });

  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as ReadableStream),
      counter,
      createWriteStream(dest)
    );
  } catch (err) {
    event.sender.send('models:progress', { file, received, total, error: String(err) });
    throw err;
  }
  event.sender.send('models:progress', { file, received, total, done: true, path: dest });
  return { path: dest };
});

ipcMain.handle('backend:status', () => getBackendStatus());
ipcMain.handle('backend:start', (_event, modelPath: unknown) =>
  startBackend(typeof modelPath === 'string' ? modelPath : '')
);
ipcMain.handle('backend:stop', () => stopBackend());

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
