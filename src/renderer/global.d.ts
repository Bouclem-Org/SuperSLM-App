interface SuperslmAppInfo {
  appVersion: string;
  platform: string;
  versions: Record<string, string>;
}

interface SuperslmApi {
  getAppInfo: () => Promise<SuperslmAppInfo>;
  getChangelog: () => Promise<string>;
}

interface Window {
  superslm?: SuperslmApi;
}
