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

export const setFullscreen = (on: boolean): Promise<void> => requireApi().setFullscreen(on);

export const listModels = (
  search: string,
  sort: SuperslmModelSort
): Promise<SuperslmModelSummary[]> => requireApi().listModels(search, sort);
