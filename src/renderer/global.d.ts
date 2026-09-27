type SuperslmTheme = 'dark' | 'light';

interface SuperslmSettings {
  theme: SuperslmTheme;
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
  listModels: (search: string, sort: SuperslmModelSort) => Promise<SuperslmModelSummary[]>;
}

interface Window {
  superslm?: SuperslmApi;
}
