import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import {
  chatCompletion,
  getBackendStatus,
  setIdleMinutes,
  startBackend,
  stopBackend,
  waitReady
} from './llamacpp';
import type { ChatMessage } from './llamacpp';
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

ipcMain.handle('settings:patch', async (_event, patch: Partial<SuperslmSettings>) => {
  const next = await patchSettings(patch);
  if (typeof patch?.idleStopMinutes === 'number') setIdleMinutes(next.idleStopMinutes);
  if (
    typeof patch?.modelFile === 'string' &&
    getBackendStatus().running &&
    getBackendStatus().model !== next.modelFile
  ) {
    stopBackend();
  }
  return next;
});

ipcMain.handle('dialog:pickGguf', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return null;
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose GGUF models',
    filters: [{ name: 'GGUF model', extensions: ['gguf'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (res.canceled || !res.filePaths.length) return null;
  const settings = await loadSettings();
  const localFiles = [...new Set([...settings.localFiles, ...res.filePaths])];
  await patchSettings({
    localFiles,
    modelFile: settings.modelFile || res.filePaths[0]
  });
  return res.filePaths;
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

ipcMain.handle('models:local', async () => {
  const base = path.join(homedir(), '.superslm', 'models');
  const out: { name: string; path: string; size: number }[] = [];
  try {
    for (const org of await readdir(base)) {
      const orgDir = path.join(base, org);
      if (!(await stat(orgDir)).isDirectory()) continue;
      for (const name of await readdir(orgDir)) {
        const dir = path.join(orgDir, name);
        if (!(await stat(dir)).isDirectory()) continue;
        for (const file of await readdir(dir)) {
          if (file.toLowerCase().endsWith('.gguf')) {
            const fp = path.join(dir, file);
            out.push({
              name: `${org}/${name} — ${file}`,
              path: fp,
              size: (await stat(fp)).size
            });
          }
        }
      }
    }
  } catch {
    // no models dir yet
  }
  return out;
});

ipcMain.handle('backend:status', () => getBackendStatus());
ipcMain.handle('backend:start', (_event, modelPath: unknown) =>
  startBackend(typeof modelPath === 'string' ? modelPath : '')
);
ipcMain.handle('backend:stop', () => stopBackend());

ipcMain.handle('backend:chat', async (_event, messages: unknown) => {
  if (!Array.isArray(messages)) throw new Error('Bad messages');
  const msgs = messages
    .filter(
      (m): m is ChatMessage =>
        !!m && typeof m.role === 'string' && typeof m.content === 'string'
    )
    .slice(-20);
  if (!msgs.length) throw new Error('Empty conversation');
  const settings = await loadSettings();
  if (!settings.modelFile) throw new Error('NO_MODEL: pick a model first');
  if (!getBackendStatus().running) startBackend(settings.modelFile);
  await waitReady();
  return { content: await chatCompletion(msgs) };
});

const execFileAsync = promisify(execFile);

ipcMain.handle('backend:install', async (event) => {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(
      'Auto-install supports Windows x64 only — place llama-server in ~/.superslm/bin manually'
    );
  }
  const send = (stage: string, received = 0, total = 0): void => {
    event.sender.send('backend:progress', { stage, received, total });
  };

  send('fetch');
  const releases = (await (
    await fetch('https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=10', {
      headers: { 'User-Agent': 'superslm' }
    })
  ).json()) as { assets?: { name: string; browser_download_url: string }[] }[];
  const settings = await loadSettings();
  const BUILD_ASSET: Record<string, RegExp> = {
    cpu: /bin-win-cpu-x64\.zip$/i,
    vulkan: /bin-win-vulkan-x64\.zip$/i,
    'cuda-12.4': /bin-win-cuda-12\.4-x64\.zip$/i,
    'cuda-13.4': /bin-win-cuda-13\.4-x64\.zip$/i
  };
  const re = BUILD_ASSET[settings.backendBuild] ?? BUILD_ASSET.vulkan;
  let asset: { name: string; browser_download_url: string } | undefined;
  for (const rel of releases) {
    const found = (rel.assets ?? []).find((a) => re.test(a.name));
    if (found) {
      asset = found;
      break;
    }
  }
  if (!asset) {
    throw new Error(`No ${settings.backendBuild} build found in recent llama.cpp releases`);
  }

  const binDir = path.join(homedir(), '.superslm', 'bin');
  await mkdir(binDir, { recursive: true });
  const zipPath = path.join(binDir, 'llamacpp.zip');

  const res = await fetch(asset.browser_download_url);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  let received = 0;
  let lastSent = 0;
  const counter = new PassThrough();
  counter.on('data', (chunk: Buffer) => {
    received += chunk.length;
    if (received - lastSent >= PROGRESS_STEP) {
      lastSent = received;
      send('download', received, total);
    }
  });
  await pipeline(
    Readable.fromWeb(res.body as unknown as ReadableStream),
    counter,
    createWriteStream(zipPath)
  );

  send('extract');
  await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${binDir}' -Force`
  ]);
  await rm(zipPath, { force: true });
  const status = getBackendStatus();
  send('done');
  if (!status.binary) throw new Error('Extracted, but llama-server was not found');
  return { path: status.binary };
});

void app.whenReady().then(async () => {
  app.setName('SuperSLM');
  app.setAppUserModelId('com.superslm.app');
  await ensureStorage();
  setIdleMinutes((await loadSettings()).idleStopMinutes);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
