import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type ThemeName = 'dark' | 'light';

export interface SuperslmSettings {
  theme: ThemeName;
}

const DEFAULT_SETTINGS: SuperslmSettings = { theme: 'dark' };
const THEME_VALUES: readonly ThemeName[] = ['dark', 'light'];

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
  await ensureStorage();
  await writeFile(settingsPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}
