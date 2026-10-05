import { contextBridge, ipcRenderer, webFrame } from 'electron';

contextBridge.exposeInMainWorld('lmsuperapp', {
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
  downloadModel: (id: string, repo: string, file: string): Promise<unknown> =>
    ipcRenderer.invoke('models:download', id, repo, file),
  openExternal: (url: string): Promise<unknown> =>
    ipcRenderer.invoke('app:openExternal', url),
  onModelProgress: (cb: (p: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown): void => cb(payload);
    ipcRenderer.on('models:progress', listener);
    return () => ipcRenderer.removeListener('models:progress', listener);
  },
  localModels: (): Promise<unknown> => ipcRenderer.invoke('models:local'),
  chatsList: (): Promise<unknown> => ipcRenderer.invoke('chats:list'),
  chatsSave: (id: string, title: string, messages: unknown): Promise<unknown> =>
    ipcRenderer.invoke('chats:save', id, title, messages),
  chatsLoad: (id: string): Promise<unknown> => ipcRenderer.invoke('chats:load', id),
  getBackendStatus: (): Promise<unknown> => ipcRenderer.invoke('backend:status'),
  startBackend: (modelPath: string): Promise<unknown> =>
    ipcRenderer.invoke('backend:start', modelPath),
  stopBackend: (): Promise<unknown> => ipcRenderer.invoke('backend:stop'),
  chatSend: (messages: unknown, stream: boolean): Promise<unknown> =>
    ipcRenderer.invoke('backend:chat', messages, stream),
  onChatChunk: (cb: (t: string) => void) => {
    const listener = (_event: unknown, text: string): void => cb(text);
    ipcRenderer.on('chat:chunk', listener);
    return () => ipcRenderer.removeListener('chat:chunk', listener);
  },
  installBackend: (): Promise<unknown> => ipcRenderer.invoke('backend:install'),
  onBackendProgress: (cb: (p: unknown) => void) => {
    const listener = (_event: unknown, payload: unknown): void => cb(payload);
    ipcRenderer.on('backend:progress', listener);
    return () => ipcRenderer.removeListener('backend:progress', listener);
  },
  setZoom: (factor: number): void => webFrame.setZoomFactor(factor)
});
