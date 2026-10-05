import type { ChildProcess } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

//TODO(config): port should be a setting once we run more than one backend
const PORT = 8391;
const BIN = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
const BASE = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 120000;
const IDLE_CHECK_MS = 30000;

export interface ChatMessage {
  role: string;
  content: string;
}

export interface BackendStatus {
  binary: string | null;
  running: boolean;
  ready: boolean;
  port: number;
  model: string;
  lastError: string | null;
}

let proc: ChildProcess | null = null;
let ready = false;
let lastError: string | null = null;
let currentModel = '';
let lastActivity = 0;
let idleMinutes = 0;
let idleTimer: NodeJS.Timeout | null = null;

const searchBin = (dir: string, depth: number): string | null => {
  if (depth < 0) return null;
  try {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = statSync(full);
      if (entry === BIN && st.isFile()) return full;
      if (st.isDirectory()) {
        const found = searchBin(full, depth - 1);
        if (found) return found;
      }
    }
  } catch {
    // unreadable dir
  }
  return null;
};

const findBinary = (): string | null => {
  const local = searchBin(path.join(homedir(), '.lmsuperapp', 'bin'), 3);
  if (local) return local;
  try {
    if (!spawnSync(BIN, ['--version'], { stdio: 'ignore' }).error) return BIN;
  } catch {
    // not on PATH
  }
  return null;
};

export const getBackendStatus = (): BackendStatus => ({
  binary: findBinary(),
  running: proc !== null,
  ready,
  port: PORT,
  model: currentModel,
  lastError
});

export const setIdleMinutes = (minutes: number): void => {
  idleMinutes = minutes;
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = null;
  if (minutes > 0) {
    idleTimer = setInterval(() => {
      if (proc && Date.now() - lastActivity > idleMinutes * 60000) stopBackend();
    }, IDLE_CHECK_MS);
  }
};

const touch = (): void => {
  lastActivity = Date.now();
};

export const startBackend = (modelPath: string): BackendStatus => {
  if (proc) return getBackendStatus();
  const bin = findBinary();
  if (!bin) {
    lastError = 'llama-server not found — install it from Settings > Backend';
    throw new Error(lastError);
  }
  if (!modelPath) throw new Error('NO_MODEL: pick a model first');
  if (!existsSync(modelPath)) throw new Error(`Model file not found: ${modelPath}`);

  lastError = null;
  ready = false;
  currentModel = modelPath;
  //TODO(params): expose --ctx-size, --n-gpu-layers, --threads etc. in Settings > Backend
  const child = spawn(
    bin,
    ['--model', modelPath, '--port', String(PORT), '--ctx-size', '4096'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  proc = child;
  touch();
  child.stderr?.on('data', (d: Buffer) => {
    lastError = d.toString().trim().slice(-300);
  });
  child.stdout?.on('data', () => {});
  child.on('error', (err) => {
    lastError = err.message;
    proc = null;
  });
  child.on('exit', () => {
    proc = null;
    ready = false;
  });
  return getBackendStatus();
};

export const waitReady = async (): Promise<void> => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!proc) throw new Error(`Backend stopped${lastError ? `: ${lastError}` : ''}`);
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) {
        ready = true;
        touch();
        return;
      }
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Backend start timed out — the model may be too large');
};

//TODO(sampling): expose temperature/top_p/top_k/system prompt per chat
export const chatCompletion = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void
): Promise<{ content: string; tokens?: number }> => {
  if (!proc) throw new Error('BACKEND_DOWN: backend is not running');
  const stream = typeof onChunk === 'function';
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      messages,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {})
    })
  });
  if (!res.ok) throw new Error(`Backend request failed: ${res.status}`);

  if (!stream) {
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { completion_tokens?: number };
    };
    touch();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      tokens: data.usage?.completion_tokens
    };
  }

  if (!res.body) throw new Error('Backend stream has no body');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let tokens: number | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut = buf.indexOf('\n\n');
    while (cut >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { completion_tokens?: number };
          };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            onChunk(delta);
            touch();
          }
          if (typeof j.usage?.completion_tokens === 'number') {
            tokens = j.usage.completion_tokens;
          }
        } catch {
          // partial JSON in a split chunk — skipped, next block completes it
        }
      }
      cut = buf.indexOf('\n\n');
    }
  }
  touch();
  return { content, tokens };
};

//TODO(lifecycle): graceful shutdown via /health first, kill only as fallback
export const stopBackend = (): BackendStatus => {
  proc?.kill();
  proc = null;
  ready = false;
  return getBackendStatus();
};
