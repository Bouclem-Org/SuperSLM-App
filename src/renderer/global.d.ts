type LmTheme = 'dark' | 'light' | 'midnight' | 'sand' | 'forest';

type LmBackendBuild = 'cpu' | 'vulkan' | 'cuda-12.4' | 'cuda-13.4';

interface LmSettings {
  theme: LmTheme;
  fullscreen: boolean;
  debug: boolean;
  devtools: boolean;
  modelFile: string;
  localFiles: string[];
  confirmDownload: boolean;
  fontScale: number;
  idleStopMinutes: number;
  backendBuild: LmBackendBuild;
}

interface LmAppInfo {
  appVersion: string;
  platform: string;
  versions: Record<string, string>;
}

type LmModelSort = 'likes' | 'downloads';

interface LmModelSummary {
  id: string;
  downloads: number;
  likes: number;
  pipeline: string;
  updated: string;
}

interface LmModelFile {
  repo: string;
  name: string;
  size: number | null;
}

interface LmModelDetail {
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
  files: LmModelFile[];
}

interface LmDownloadProgress {
  file: string;
  received: number;
  total: number;
  done?: boolean;
  path?: string;
  error?: string;
}

interface LmBackendStatus {
  binary: string | null;
  running: boolean;
  ready: boolean;
  port: number;
  model: string;
  lastError: string | null;
}

interface LmStoredMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  versions?: string[];
  vi?: number;
  ts?: number;
  stats?: { tps?: number; approx?: boolean }[];
}

interface LmChatMeta {
  id: string;
  title: string;
  updated: number;
}

interface LmLocalModel {
  name: string;
  path: string;
  size: number;
}

interface LmChatMessage {
  role: string;
  content: string;
}

interface LmInstallProgress {
  stage: 'fetch' | 'download' | 'extract' | 'done';
  received: number;
  total: number;
}

interface LmApi {
  getAppInfo: () => Promise<LmAppInfo>;
  getChangelog: () => Promise<string>;
  getSettings: () => Promise<LmSettings>;
  patchSettings: (patch: Partial<LmSettings>) => Promise<LmSettings>;
  pickGguf: () => Promise<string[] | null>;
  setFullscreen: (on: boolean) => Promise<void>;
  openDevTools: () => Promise<void>;
  listModels: (search: string, sort: LmModelSort) => Promise<LmModelSummary[]>;
  getModelDetail: (id: string) => Promise<LmModelDetail>;
  downloadModel: (
    id: string,
    repo: string,
    file: string
  ) => Promise<{ path?: string; cancelled?: boolean }>;
  openExternal: (url: string) => Promise<unknown>;
  onModelProgress: (cb: (p: LmDownloadProgress) => void) => () => void;
  getBackendStatus: () => Promise<LmBackendStatus>;
  startBackend: (modelPath: string) => Promise<LmBackendStatus>;
  stopBackend: () => Promise<LmBackendStatus>;
  localModels: () => Promise<LmLocalModel[]>;
  chatsList: () => Promise<LmChatMeta[]>;
  chatsSave: (
    id: string,
    title: string,
    messages: LmStoredMessage[]
  ) => Promise<{ title: string; updated: number; messages: LmStoredMessage[] }>;
  chatsLoad: (
    id: string
  ) => Promise<{ title: string; updated: number; messages: LmStoredMessage[] }>;
  chatSend: (
    messages: LmChatMessage[]
  ) => Promise<{ content: string; tokPerSec?: number; approx?: boolean }>;
  installBackend: () => Promise<{ path: string }>;
  onBackendProgress: (cb: (p: LmInstallProgress) => void) => () => void;
  setZoom: (factor: number) => void;
}

interface Window {
  lmsuperapp?: LmApi;
}
