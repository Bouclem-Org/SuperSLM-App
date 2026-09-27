type SuperslmTheme = 'dark' | 'light' | 'midnight' | 'sand' | 'forest';

interface SuperslmSettings {
  theme: SuperslmTheme;
  fullscreen: boolean;
  debug: boolean;
  devtools: boolean;
}

interface SuperslmAppInfo {
  appVersion: string;
  platform: string;
  versions: Record<string, string>;
}

type SuperslmModelSort = 'likes' | 'downloads';

interface SuperslmModelSummary {
  id: string;
  downloads: number;
  likes: number;
  pipeline: string;
  updated: string;
}

interface SuperslmApi {
  getAppInfo: () => Promise<SuperslmAppInfo>;
  getChangelog: () => Promise<string>;
  getSettings: () => Promise<SuperslmSettings>;
  patchSettings: (patch: Partial<SuperslmSettings>) => Promise<SuperslmSettings>;
  setFullscreen: (on: boolean) => Promise<void>;
  openDevTools: () => Promise<void>;
  listModels: (search: string, sort: SuperslmModelSort) => Promise<SuperslmModelSummary[]>;
}

interface Window {
  superslm?: SuperslmApi;
}
