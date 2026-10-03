import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type ThemeName = 'dark' | 'light' | 'midnight' | 'sand' | 'forest';

export interface SuperslmSettings {
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
}

export type BackendBuild = 'cpu' | 'vulkan' | 'cuda-12.4' | 'cuda-13.4';

const BACKEND_BUILDS = new Set<BackendBuild>(['cpu', 'vulkan', 'cuda-12.4', 'cuda-13.4']);

const DEFAULT_SETTINGS: SuperslmSettings = {
  theme: 'dark',
  fullscreen: false,
  debug: false,
  devtools: false,
  modelFile: '',
  localFiles: [],
  confirmDownload: true,
  fontScale: 1,
  idleStopMinutes: 10,
  backendBuild: 'vulkan'
};

const THEME_VALUES: readonly ThemeName[] = ['dark', 'light', 'midnight', 'sand', 'forest'];

export const THEME_BG: Record<ThemeName, string> = {
  dark: '#1b1b1e',
  light: '#f2f0ec',
  midnight: '#14151c',
  sand: '#f6f0e4',
  forest: '#151b17'
};

const superslmDir = (): string => path.join(os.homedir(), '.superslm');
const settingsPath = (): string => path.join(superslmDir(), 'settings.json');

export async function ensureStorage(): Promise<void> {
  await mkdir(superslmDir(), { recursive: true });
}

export async function loadSettings(): Promise<SuperslmSettings> {
  try {
    const raw = await readFile(settingsPath(), 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as SuperslmSettings;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to read settings.json, using defaults:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }
}

export async function patchSettings(
  patch: Partial<SuperslmSettings>
): Promise<SuperslmSettings> {
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
  await ensureStorage();
  await writeFile(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}
