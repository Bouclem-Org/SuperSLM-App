interface SuperslmAppInfo {
  platform: string;
  versions: Record<string, string>;
}

interface SuperslmApi {
  getAppInfo: () => Promise<SuperslmAppInfo>;
}

interface Window {
  superslm?: SuperslmApi;
}
