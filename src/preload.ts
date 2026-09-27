import { contextBridge, ipcRenderer, webFrame } from 'electron';

contextBridge.exposeInMainWorld('superslm', {
  getAppInfo: (): Promise<unknown> => ipcRenderer.invoke('app:info'),
  getChangelog: (): Promise<unknown> => ipcRenderer.invoke('app:changelog'),
  getSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
  patchSettings: (patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:patch', patch),
  pickGguf: (): Promise<unknown> => ipcRenderer.invoke('dialog:pickGguf'),
  setFullscreen: (on: boolean): Promise<unknown> =>
    ipcRenderer.invoke('window:fullscreen', on),
  openDevTools: (): Promise<unknown> => ipcRenderer.invoke('window:devtools'),
  listModels: (search: string, sort: string): Promise<unknown> =>
    ipcRenderer.invoke('models:list', search, sort),
  getModelDetail: (id: string): Promise<unknown> => ipcRenderer.invoke('models:detail', id),
  downloadModel: (id: string, file: string): Promise<unknown> =>
    ipcRenderer.invoke('models:download', id, file),
  onModelProgress: (cb: (p: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown): void => cb(payload);
    ipcRenderer.on('models:progress', listener);
    return () => ipcRenderer.removeListener('models:progress', listener);
  },
  getBackendStatus: (): Promise<unknown> => ipcRenderer.invoke('backend:status'),
  startBackend: (modelPath: string): Promise<unknown> =>
    ipcRenderer.invoke('backend:start', modelPath),
  stopBackend: (): Promise<unknown> => ipcRenderer.invoke('backend:stop'),
  setZoom: (factor: number): void => webFrame.setZoomFactor(factor)
});
