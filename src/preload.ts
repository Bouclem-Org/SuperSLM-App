import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('superslm', {
  getAppInfo: (): Promise<unknown> => ipcRenderer.invoke('app:info'),
  getChangelog: (): Promise<unknown> => ipcRenderer.invoke('app:changelog'),
  getSettings: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
  patchSettings: (patch: unknown): Promise<unknown> =>
    ipcRenderer.invoke('settings:patch', patch),
  setFullscreen: (on: boolean): Promise<unknown> =>
    ipcRenderer.invoke('window:fullscreen', on),
  listModels: (search: string, sort: string): Promise<unknown> =>
    ipcRenderer.invoke('models:list', search, sort)
});
