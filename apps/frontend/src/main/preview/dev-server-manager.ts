import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import { portAllocator } from './port-allocator';

type PreviewStatus = 'idle' | 'starting' | 'ready' | 'failed' | 'stopped';

interface PreviewEntry {
  process: ChildProcess;
  port: number;
  status: PreviewStatus;
  lastError: string | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const READINESS_POLL_INTERVAL_MS = 500;
const READINESS_TIMEOUT_MS = 10_000;

const registry = new Map<string, PreviewEntry>();

export interface PreviewStartResult {
  port: number;
  url: string;
}

export async function startPreview(
  taskId: string,
  worktreePath: string,
  command: string
): Promise<PreviewStartResult> {
  stopPreview(taskId);

  const port = portAllocator.allocate();
  const [cmd, ...args] = command.split(' ');

  const env = { ...process.env, PORT: String(port) };
  const resolvedArgs = args.map((a) => a.replace('${PORT}', String(port)));

  const child = spawn(cmd, resolvedArgs, {
    cwd: worktreePath,
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let lastStderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    lastStderr = chunk.toString().trim().split('\n').pop() ?? lastStderr;
  });

  const entry: PreviewEntry = {
    process: child,
    port,
    status: 'starting',
    lastError: null,
    idleTimer: null,
  };
  registry.set(taskId, entry);

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + READINESS_TIMEOUT_MS;

    const poll = () => {
      if (!registry.has(taskId)) {
        reject(new Error('Preview stopped before becoming ready'));
        return;
      }

      const req = http.get(`http://localhost:${port}`, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          entry.status = 'ready';
          entry.idleTimer = setTimeout(() => stopPreview(taskId), IDLE_TIMEOUT_MS);
          resolve({ port, url: `http://localhost:${port}` });
        } else {
          scheduleNext();
        }
        res.resume();
      });
      req.on('error', scheduleNext);
      req.setTimeout(READINESS_POLL_INTERVAL_MS, () => req.destroy());
    };

    const scheduleNext = () => {
      if (Date.now() > deadline) {
        entry.status = 'failed';
        entry.lastError = lastStderr || 'Timed out waiting for dev server';
        portAllocator.release(port);
        registry.delete(taskId);
        reject(new Error(entry.lastError));
        return;
      }
      setTimeout(poll, READINESS_POLL_INTERVAL_MS);
    };

    child.on('exit', (code) => {
      if (entry.status === 'starting') {
        entry.status = 'failed';
        entry.lastError = lastStderr || `Process exited with code ${code}`;
        portAllocator.release(port);
        registry.delete(taskId);
        reject(new Error(entry.lastError));
      } else if (entry.status === 'ready') {
        entry.status = 'stopped';
        portAllocator.release(port);
        registry.delete(taskId);
      }
    });

    poll();
  });
}

export function stopPreview(taskId: string): void {
  const entry = registry.get(taskId);
  if (!entry) return;

  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  entry.process.kill();
  portAllocator.release(entry.port);
  registry.delete(taskId);
}

export function getPreviewStatus(taskId: string): {
  status: PreviewStatus;
  port: number | null;
  url: string | null;
  lastError: string | null;
} {
  const entry = registry.get(taskId);
  if (!entry) return { status: 'idle', port: null, url: null, lastError: null };
  return {
    status: entry.status,
    port: entry.port,
    url: entry.status === 'ready' ? `http://localhost:${entry.port}` : null,
    lastError: entry.lastError,
  };
}

export function keepAlive(taskId: string): void {
  const entry = registry.get(taskId);
  if (!entry || !entry.idleTimer) return;
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => stopPreview(taskId), IDLE_TIMEOUT_MS);
}

export function stopAllPreviews(): void {
  for (const taskId of registry.keys()) {
    stopPreview(taskId);
  }
}
