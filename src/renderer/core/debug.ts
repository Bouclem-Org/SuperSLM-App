export interface DebugEntry {
  time: string;
  label: string;
  detail: string;
}

const MAX_ENTRIES = 50;
let enabled = false;
const entries: DebugEntry[] = [];

export const setDebugEnabled = (on: boolean): void => {
  enabled = on;
};

export const isDebugEnabled = (): boolean => enabled;

export const reportDebug = (label: string, err: unknown): void => {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  entries.unshift({ time: new Date().toLocaleTimeString(), label, detail });
  if (entries.length > MAX_ENTRIES) entries.pop();
  document.dispatchEvent(new CustomEvent('superslm:debug'));
};

export const getDebugEntries = (): readonly DebugEntry[] => entries;
