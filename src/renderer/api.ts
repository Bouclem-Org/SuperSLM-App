const requireApi = (): SuperslmApi => {
  const api = window.superslm;
  if (!api) throw new Error('Preload bridge unavailable');
  return api;
};

export const getAppInfo = (): Promise<SuperslmAppInfo> => requireApi().getAppInfo();

export const getChangelog = (): Promise<string> => requireApi().getChangelog();

export const getSettings = (): Promise<SuperslmSettings> => requireApi().getSettings();

export const patchSettings = (patch: Partial<SuperslmSettings>): Promise<SuperslmSettings> =>
  requireApi().patchSettings(patch);

export const pickGguf = (): Promise<string[] | null> => requireApi().pickGguf();

export const setFullscreen = (on: boolean): Promise<void> => requireApi().setFullscreen(on);

export const openDevTools = (): Promise<void> => requireApi().openDevTools();

export const listModels = (
  search: string,
  sort: SuperslmModelSort
): Promise<SuperslmModelSummary[]> => requireApi().listModels(search, sort);

export const getModelDetail = (id: string): Promise<SuperslmModelDetail> =>
  requireApi().getModelDetail(id);

export const downloadModel = (
  id: string,
  file: string
): Promise<{ path?: string; cancelled?: boolean }> => requireApi().downloadModel(id, file);

export const onModelProgress = (
  cb: (p: SuperslmDownloadProgress) => void
): (() => void) => requireApi().onModelProgress(cb);

export const getBackendStatus = (): Promise<SuperslmBackendStatus> =>
  requireApi().getBackendStatus();

export const startBackend = (modelPath: string): Promise<SuperslmBackendStatus> =>
  requireApi().startBackend(modelPath);

export const stopBackend = (): Promise<SuperslmBackendStatus> => requireApi().stopBackend();

export const localModels = (): Promise<SuperslmLocalModel[]> => requireApi().localModels();

export const chatsList = (): Promise<SuperslmChatMeta[]> => requireApi().chatsList();

export const chatsSave = (
  id: string,
  title: string,
  messages: SuperslmChatMessage[]
): Promise<{ title: string; updated: number; messages: SuperslmChatMessage[] }> =>
  requireApi().chatsSave(id, title, messages);

export const chatsLoad = (
  id: string
): Promise<{ title: string; updated: number; messages: SuperslmChatMessage[] }> =>
  requireApi().chatsLoad(id);

export const chatSend = (
  messages: SuperslmChatMessage[]
): Promise<{ content: string }> => requireApi().chatSend(messages);

export const installBackend = (): Promise<{ path: string }> => requireApi().installBackend();

export const onBackendProgress = (
  cb: (p: SuperslmInstallProgress) => void
): (() => void) => requireApi().onBackendProgress(cb);

export const setZoom = (factor: number): void => requireApi().setZoom(factor);
