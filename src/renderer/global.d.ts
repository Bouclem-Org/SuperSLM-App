type SuperslmTheme = 'dark' | 'light' | 'midnight' | 'sand' | 'forest';

interface SuperslmSettings {
  theme: SuperslmTheme;
  fullscreen: boolean;
  debug: boolean;
  devtools: boolean;
  modelFile: string;
  confirmDownload: boolean;
  fontScale: number;
  idleStopMinutes: number;
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

interface SuperslmModelFile {
  name: string;
  size: number | null;
}

interface SuperslmModelDetail {
  id: string;
  author: string;
  pipeline: string;
  library: string;
  downloads: number;
  likes: number;
  updated: string;
  tags: string[];
  readme: string | null;
  readmeTruncated: boolean;
  files: SuperslmModelFile[];
}

interface SuperslmDownloadProgress {
  file: string;
  received: number;
  total: number;
  done?: boolean;
  path?: string;
  error?: string;
}

interface SuperslmBackendStatus {
  binary: string | null;
  running: boolean;
  ready: boolean;
  port: number;
  model: string;
  lastError: string | null;
}

interface SuperslmLocalModel {
  name: string;
  path: string;
}

interface SuperslmChatMessage {
  role: string;
  content: string;
}

interface SuperslmInstallProgress {
  stage: 'fetch' | 'download' | 'extract' | 'done';
  received: number;
  total: number;
}

interface SuperslmApi {
  getAppInfo: () => Promise<SuperslmAppInfo>;
  getChangelog: () => Promise<string>;
  getSettings: () => Promise<SuperslmSettings>;
  patchSettings: (patch: Partial<SuperslmSettings>) => Promise<SuperslmSettings>;
  pickGguf: () => Promise<string | null>;
  setFullscreen: (on: boolean) => Promise<void>;
  openDevTools: () => Promise<void>;
  listModels: (search: string, sort: SuperslmModelSort) => Promise<SuperslmModelSummary[]>;
  getModelDetail: (id: string) => Promise<SuperslmModelDetail>;
  downloadModel: (id: string, file: string) => Promise<{ path?: string; cancelled?: boolean }>;
  onModelProgress: (cb: (p: SuperslmDownloadProgress) => void) => () => void;
  getBackendStatus: () => Promise<SuperslmBackendStatus>;
  startBackend: (modelPath: string) => Promise<SuperslmBackendStatus>;
  stopBackend: () => Promise<SuperslmBackendStatus>;
  localModels: () => Promise<SuperslmLocalModel[]>;
  chatSend: (messages: SuperslmChatMessage[]) => Promise<{ content: string }>;
  installBackend: () => Promise<{ path: string }>;
  onBackendProgress: (cb: (p: SuperslmInstallProgress) => void) => () => void;
  setZoom: (factor: number) => void;
}

interface Window {
  superslm?: SuperslmApi;
}
