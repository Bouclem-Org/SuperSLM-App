import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('superslm', {
  getAppInfo: (): Promise<unknown> => ipcRenderer.invoke('app:info'),
  getChangelog: (): Promise<unknown> => ipcRenderer.invoke('app:changelog')
});
