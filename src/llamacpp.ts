import type { ChildProcess } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const BIN = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
const READY_TIMEOUT_MS = 120000;
const IDLE_CHECK_MS = 30000;
const KILL_TIMEOUT_MS = 3000;

export interface ChatMessage {
  role: string;
  content: string;
}

export interface LaunchParams {
  port: number;
  ctxSize: number;
  gpuLayers: number; // -1 = let llama.cpp decide
  threads: number; // 0 = auto
}

export interface SamplingParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  systemPrompt?: string;
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
let launch: LaunchParams = { port: 8391, ctxSize: 4096, gpuLayers: -1, threads: 0 };
let activePort = launch.port;

const base = (): string => `http://127.0.0.1:${activePort}`;

export const setLaunchParams = (params: LaunchParams): void => {
  launch = { ...params };
};

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
  port: proc ? activePort : launch.port,
  model: currentModel,
  lastError
});

export const setIdleMinutes = (minutes: number): void => {
  idleMinutes = minutes;
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = null;
  if (minutes > 0) {
    idleTimer = setInterval(() => {
      if (proc && Date.now() - lastActivity > idleMinutes * 60000) void stopBackend();
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
  const args = [
    '--model',
    modelPath,
    '--port',
    String(launch.port),
    '--ctx-size',
    String(launch.ctxSize)
  ];
  if (launch.gpuLayers >= 0) args.push('--n-gpu-layers', String(launch.gpuLayers));
  if (launch.threads > 0) args.push('--threads', String(launch.threads));
  const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc = child;
  activePort = launch.port;
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
      const res = await fetch(`${base()}/health`);
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

export const chatCompletion = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  sampling?: SamplingParams
): Promise<{ content: string; tokens?: number }> => {
  if (!proc) throw new Error('BACKEND_DOWN: backend is not running');
  const stream = typeof onChunk === 'function';
  const msgs = sampling?.systemPrompt
    ? [{ role: 'system', content: sampling.systemPrompt }, ...messages]
    : messages;
  const res = await fetch(`${base()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local',
      messages: msgs,
      stream,
      ...(sampling?.temperature !== undefined ? { temperature: sampling.temperature } : {}),
      ...(sampling?.topP !== undefined ? { top_p: sampling.topP } : {}),
      ...(sampling?.topK !== undefined ? { top_k: sampling.topK } : {}),
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

export const stopBackend = async (): Promise<BackendStatus> => {
  const p = proc;
  proc = null;
  ready = false;
  if (!p || p.exitCode !== null || p.signalCode !== null) return getBackendStatus();
  p.kill(); // SIGTERM first — llama-server shuts down cleanly on POSIX
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      resolve();
    }, KILL_TIMEOUT_MS);
    p.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return getBackendStatus();
};
