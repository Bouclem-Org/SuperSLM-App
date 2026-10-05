import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type ThemeName = 'dark' | 'light' | 'midnight' | 'sand' | 'forest';

export interface LmSettings {
  theme: ThemeName;
  fullscreen: boolean;
  debug: boolean;
  devtools: boolean;
  modelFile: string;
  localFiles: string[];
  confirmDownload: boolean;
  fontScale: number;
  idleStopMinutes: number;
  backendBuild: BackendBuild;
  streamReplies: boolean;
  notifyOnReply: boolean;
  contextMessages: number;
  confirmOnClose: boolean;
  defaultModelSort: 'likes' | 'downloads';
}

export type BackendBuild = 'cpu' | 'vulkan' | 'cuda-12.4' | 'cuda-13.4';

const BACKEND_BUILDS = new Set<BackendBuild>(['cpu', 'vulkan', 'cuda-12.4', 'cuda-13.4']);

const DEFAULT_SETTINGS: LmSettings = {
  theme: 'dark',
  fullscreen: false,
  debug: false,
  devtools: false,
  modelFile: '',
  localFiles: [],
  confirmDownload: true,
  fontScale: 1,
  idleStopMinutes: 10,
  backendBuild: 'vulkan',
  streamReplies: true,
  notifyOnReply: false,
  contextMessages: 20,
  confirmOnClose: false,
  defaultModelSort: 'likes'
};

const THEME_VALUES: readonly ThemeName[] = ['dark', 'light', 'midnight', 'sand', 'forest'];

export const THEME_BG: Record<ThemeName, string> = {
  dark: '#1b1b1e',
  light: '#f2f0ec',
  midnight: '#14151c',
  sand: '#f6f0e4',
  forest: '#151b17'
};

const dataDir = (): string => path.join(os.homedir(), '.lmsuperapp');
const legacyDir = (): string => path.join(os.homedir(), '.superslm'); // pre-0.2.1 name
const settingsPath = (): string => path.join(dataDir(), 'settings.json');

export async function ensureStorage(): Promise<void> {
  // one-time move of the old ~/.superslm dir (settings, models, chats, bin)
  try {
    if (existsSync(legacyDir()) && !existsSync(dataDir())) {
      await rename(legacyDir(), dataDir());
    }
  } catch (err) {
    console.error('Failed to migrate ~/.superslm to ~/.lmsuperapp:', err);
  }
  await mkdir(dataDir(), { recursive: true });
}

// paths saved under the old dir still point there after the rename — remap them
const remapPath = (p: string): string =>
  p.startsWith(legacyDir()) ? dataDir() + p.slice(legacyDir().length) : p;

//TODO(settings): schema version + migration path once settings keep growing
export async function loadSettings(): Promise<LmSettings> {
  await ensureStorage();
  try {
    const raw = await readFile(settingsPath(), 'utf8');
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as LmSettings;
    s.modelFile = remapPath(s.modelFile);
    s.localFiles = s.localFiles.map(remapPath);
    return s;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to read settings.json, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export async function patchSettings(
  patch: Partial<LmSettings>
): Promise<LmSettings> {
  const next = await loadSettings();
  if (patch.theme && THEME_VALUES.includes(patch.theme)) next.theme = patch.theme;
  if (typeof patch.fullscreen === 'boolean') next.fullscreen = patch.fullscreen;
  if (typeof patch.debug === 'boolean') next.debug = patch.debug;
  if (typeof patch.devtools === 'boolean') next.devtools = patch.devtools;
  if (typeof patch.modelFile === 'string' && patch.modelFile.length < 1024) {
    next.modelFile = patch.modelFile;
  }
  if (Array.isArray(patch.localFiles)) {
    next.localFiles = patch.localFiles
      .filter((f): f is string => typeof f === 'string' && f.length > 0 && f.length < 1024)
      .slice(0, 50);
  }
  if (typeof patch.confirmDownload === 'boolean') next.confirmDownload = patch.confirmDownload;
  if (
    typeof patch.fontScale === 'number' &&
    patch.fontScale >= 0.7 &&
    patch.fontScale <= 1.5
  ) {
    next.fontScale = Math.round(patch.fontScale * 100) / 100;
  }
  if (
    typeof patch.idleStopMinutes === 'number' &&
    Number.isInteger(patch.idleStopMinutes) &&
    patch.idleStopMinutes >= 0 &&
    patch.idleStopMinutes <= 120
  ) {
    next.idleStopMinutes = patch.idleStopMinutes;
  }
  if (
    typeof patch.backendBuild === 'string' &&
    BACKEND_BUILDS.has(patch.backendBuild as BackendBuild)
  ) {
    next.backendBuild = patch.backendBuild as BackendBuild;
  }
  if (typeof patch.streamReplies === 'boolean') next.streamReplies = patch.streamReplies;
  if (typeof patch.notifyOnReply === 'boolean') next.notifyOnReply = patch.notifyOnReply;
  if (typeof patch.confirmOnClose === 'boolean') next.confirmOnClose = patch.confirmOnClose;
  if (
    typeof patch.contextMessages === 'number' &&
    Number.isInteger(patch.contextMessages) &&
    patch.contextMessages >= 1 &&
    patch.contextMessages <= 100
  ) {
    next.contextMessages = patch.contextMessages;
  }
  if (patch.defaultModelSort === 'likes' || patch.defaultModelSort === 'downloads') {
    next.defaultModelSort = patch.defaultModelSort;
  }
  await ensureStorage();
  await writeFile(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}
