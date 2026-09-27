import type { ChildProcess } from 'node:child_process';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PORT = 8391;
const BIN = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';

let proc: ChildProcess | null = null;
let lastError: string | null = null;

const findBinary = (): string | null => {
  const local = path.join(homedir(), '.superslm', 'bin', BIN);
  if (existsSync(local)) return local;
  try {
    const res = spawnSync(BIN, ['--version'], { stdio: 'ignore' });
    if (!res.error) return BIN;
  } catch {
    // not on PATH
  }
  return null;
};

export interface BackendStatus {
  binary: string | null;
  running: boolean;
  port: number;
  lastError: string | null;
}

export const getBackendStatus = (): BackendStatus => ({
  binary: findBinary(),
  running: proc !== null,
  port: PORT,
  lastError
});

export const startBackend = (modelPath: string): BackendStatus => {
  if (proc) return getBackendStatus();
  const bin = findBinary();
  if (!bin) {
    lastError = 'llama-server not found — place the binary in ~/.superslm/bin or on PATH';
    throw new Error(lastError);
  }
  if (!modelPath) throw new Error('No model selected — pick a local .gguf file first');
  if (!existsSync(modelPath)) throw new Error(`Model file not found: ${modelPath}`);

  lastError = null;
  const child = spawn(bin, ['--model', modelPath, '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  proc = child;
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  child.on('error', (err) => {
    lastError = err.message;
    proc = null;
  });
  child.on('exit', () => {
    proc = null;
  });
  return getBackendStatus();
};

export const stopBackend = (): BackendStatus => {
  proc?.kill();
  proc = null;
  return getBackendStatus();
};
