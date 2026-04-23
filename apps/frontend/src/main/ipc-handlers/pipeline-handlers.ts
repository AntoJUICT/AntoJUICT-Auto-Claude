import { ipcMain, app } from 'electron';
import type { BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import path from 'path';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import { AgentManager } from '../agent';
import { getBestAvailableProfileEnv } from '../rate-limit-detector';
import { getAugmentedEnv } from '../env-utils';
import { pythonEnvManager } from '../python-env-manager';
import { getPathDelimiter } from '../platform';
import { parsePythonCommand } from '../python-detector';
import { safeSendToRenderer } from './utils';

// ---------------------------------------------------------------------------
// Visual Companion — session management
// ---------------------------------------------------------------------------

interface VisualSession {
  process: ChildProcess;
  url: string;
  screenDir: string;
  stateDir: string;
}

const visualSessions = new Map<string, VisualSession>();

/**
 * Resolve the path to the bundled Visual Companion server script.
 * In a packaged build the file lives under process.resourcesPath;
 * in development it is relative to this compiled file's __dirname.
 */
function getServerScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'visual-companion', 'server.cjs');
  }
  // In dev mode electron-vite compiles all main-process code into a single
  // out/main/index.js bundle, so __dirname === <project>/apps/frontend/out/main.
  // Two levels up reaches apps/frontend/, then into resources/.
  return path.join(__dirname, '../../resources/visual-companion/server.cjs');
}

/**
 * Start (or return an existing) Visual Companion server for the given taskId.
 * Uses app.getPath('temp') so the directory is always writable on Windows.
 */
function ensureVisualSession(taskId: string): Promise<VisualSession> {
  const existing = visualSessions.get(taskId);
  if (existing) return Promise.resolve(existing);

  const sessionDir = path.join(app.getPath('temp'), 'brainstorm', taskId);
  try {
    mkdirSync(path.join(sessionDir, 'content'), { recursive: true });
    mkdirSync(path.join(sessionDir, 'state'), { recursive: true });
  } catch (err) {
    return Promise.reject(new Error(`Failed to create visual companion session dir: ${err}`));
  }

  return new Promise((resolve, reject) => {
    const serverPath = getServerScriptPath();
    const child = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        BRAINSTORM_DIR: sessionDir,
        BRAINSTORM_OWNER_PID: String(process.pid),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuf = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('Visual Companion server did not start within 10s'));
    }, 10_000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf-8');
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.type === 'server-started') {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            const session: VisualSession = {
              process: child,
              url: msg.url as string,
              screenDir: msg.screen_dir as string,
              stateDir: msg.state_dir as string,
            };
            visualSessions.set(taskId, session);
            resolve(session);
          }
        } catch {
          // Non-JSON line — ignore
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      console.debug('[VisualCompanion stderr]', chunk.toString('utf-8').trimEnd());
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err);
    });

    child.on('exit', () => {
      // Remove session so the next brainstorm message for this task
      // restarts the server automatically (server has a 30-min idle timeout).
      visualSessions.delete(taskId);
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Visual companion server exited before ready'));
      }
    });
  });
}

/**
 * Stop and remove the Visual Companion session for the given taskId.
 */
function stopVisualSession(taskId: string): void {
  const session = visualSessions.get(taskId);
  if (!session) return;
  try {
    session.process.kill();
  } catch {
    // Already dead — ignore
  }
  visualSessions.delete(taskId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build the spawn environment for pipeline runner subprocesses.
 * Mirrors the getSpawnEnv() pattern used in execution-handlers.ts.
 */
function buildSpawnEnv(agentManager: AgentManager): NodeJS.ProcessEnv {
  const profileResult = getBestAvailableProfileEnv();
  const augmented = getAugmentedEnv();
  const pythonEnv = pythonEnvManager.getPythonEnv();
  const autoBuildSource = agentManager.getAutoBuildSourcePath();
  const pythonPathParts: string[] = [];
  if (pythonEnv.PYTHONPATH) pythonPathParts.push(pythonEnv.PYTHONPATH);
  if (autoBuildSource) pythonPathParts.push(autoBuildSource);
  return {
    ...augmented,
    ...pythonEnv,
    ...profileResult.env,
    ...(pythonPathParts.length ? { PYTHONPATH: pythonPathParts.join(getPathDelimiter()) } : {}),
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  };
}

/**
 * Resolve the full path to a runner script inside the backend source.
 * Returns null when the backend source directory cannot be determined.
 */
function resolveRunnerPath(
  agentManager: AgentManager,
  scriptName: string
): string | null {
  const backendSource = agentManager.getAutoBuildSourcePath();
  if (!backendSource) return null;
  return path.join(backendSource, 'runners', scriptName);
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Register all pipeline-related IPC handlers.
 *
 * Channels:
 *   PIPELINE_BRAINSTORM_MESSAGE   — one-shot brainstorm turn (stdin/stdout JSON)
 *   PIPELINE_WRITE_PLAN           — stream plan-writing progress to renderer
 *   PIPELINE_GET_FUNCTIONAL_PLAN  — read functional_plan.md from spec dir
 *   PIPELINE_FINISH               — stream finisher progress to renderer
 */
export function registerPipelineHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // ============================================================
  // PIPELINE_BRAINSTORM_MESSAGE
  // Spawns brainstorm_runner.py, sends JSON via stdin, awaits
  // a single JSON response on stdout (60s timeout).
  // ============================================================
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_BRAINSTORM_MESSAGE,
    async (
      _,
      payload: {
        taskId: string;
        messages: Array<{ role: string; content: string }>;
        project_dir: string;
      }
    ): Promise<IPCResult<{ response: string; ready_to_plan: boolean; spec_summary: string | null; visual_url: string | null }>> => {
      // Ensure Python venv is ready before spawning
      const envCheck = await agentManager.ensurePythonEnvReady();
      if (!envCheck.ready) {
        return { success: false, error: `Python environment not ready: ${envCheck.error}` };
      }

      const scriptPath = resolveRunnerPath(agentManager, 'brainstorm_runner.py');
      if (!scriptPath) {
        return { success: false, error: 'Cannot locate backend source directory' };
      }

      // Start (or reuse) the Visual Companion server for this task.
      // Errors are non-fatal — brainstorm continues without visual companion.
      let visualSession: VisualSession | null = null;
      try {
        visualSession = await ensureVisualSession(payload.taskId);
      } catch (err) {
        console.warn('[PipelineHandlers] Visual Companion failed to start (non-fatal):', err);
      }

      const pythonPath = agentManager.getPythonPath();
      const [pythonCmd, pythonBaseArgs] = parsePythonCommand(pythonPath);
      const spawnEnv = buildSpawnEnv(agentManager);

      // Extend the payload with the screen directory so the Python runner can
      // write screenshots that the Visual Companion server can serve.
      const runnerPayload = {
        ...payload,
        screen_dir: visualSession?.screenDir ?? null,
      };

      return new Promise((resolve) => {
        const child = spawn(pythonCmd, [...pythonBaseArgs, scriptPath], {
          cwd: payload.project_dir,
          env: spawnEnv,
        });

        let stdoutBuf = '';
        let timedOut = false;

        const timeout = setTimeout(() => {
          timedOut = true;
          child.kill();
          resolve({ success: false, error: 'brainstorm_runner.py timed out after 60s' });
        }, 60_000);

        // Write payload to stdin and close it
        try {
          child.stdin?.write(JSON.stringify(runnerPayload));
          child.stdin?.end();
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, error: String(err) });
          return;
        }

        child.stdout?.on('data', (chunk: Buffer) => {
          stdoutBuf += chunk.toString('utf-8');
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          console.debug('[PipelineHandlers brainstorm stderr]', chunk.toString('utf-8').trimEnd());
        });

        child.on('exit', (code) => {
          if (timedOut) return;
          clearTimeout(timeout);
          try {
            const data = JSON.parse(stdoutBuf.trim());
            resolve({
              success: true,
              data: {
                ...data,
                visual_url: visualSession?.url ?? null,
              },
            });
          } catch {
            resolve({
              success: false,
              error: `brainstorm_runner.py exited ${code} with non-JSON output: ${stdoutBuf.slice(0, 200)}`,
            });
          }
        });

        child.on('error', (err) => {
          if (timedOut) return;
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });
      });
    }
  );

  // ============================================================
  // PIPELINE_WRITE_PLAN
  // Spawns plan_writer_runner.py, streams JSON-lines progress
  // via PIPELINE_PLAN_PROGRESS to the renderer.
  // ============================================================
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_WRITE_PLAN,
    async (
      _,
      payload: { spec_summary: string; spec_dir: string; project_dir: string }
    ): Promise<IPCResult<void>> => {
      const envCheck = await agentManager.ensurePythonEnvReady();
      if (!envCheck.ready) {
        return { success: false, error: `Python environment not ready: ${envCheck.error}` };
      }

      const scriptPath = resolveRunnerPath(agentManager, 'plan_writer_runner.py');
      if (!scriptPath) {
        return { success: false, error: 'Cannot locate backend source directory' };
      }

      const pythonPath = agentManager.getPythonPath();
      const [pythonCmd, pythonBaseArgs] = parsePythonCommand(pythonPath);
      const spawnEnv = buildSpawnEnv(agentManager);

      return new Promise((resolve) => {
        const child = spawn(pythonCmd, [...pythonBaseArgs, scriptPath], {
          cwd: payload.project_dir,
          env: spawnEnv,
        });

        let stdoutBuf = '';

        // Write payload to stdin and close it
        try {
          child.stdin?.write(JSON.stringify(payload));
          child.stdin?.end();
        } catch (err) {
          resolve({ success: false, error: String(err) });
          return;
        }

        child.stdout?.on('data', (chunk: Buffer) => {
          stdoutBuf += chunk.toString('utf-8');
          const lines = stdoutBuf.split('\n');
          stdoutBuf = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed);
              safeSendToRenderer(getMainWindow, IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, event);
            } catch {
              // Non-JSON line — ignore
            }
          }
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          console.debug('[PipelineHandlers plan_writer stderr]', chunk.toString('utf-8').trimEnd());
        });

        child.on('exit', (code) => {
          // Flush remaining buffer
          if (stdoutBuf.trim()) {
            try {
              const event = JSON.parse(stdoutBuf.trim());
              safeSendToRenderer(getMainWindow, IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, event);
            } catch {
              // Ignore malformed final line
            }
          }
          if (code !== 0) {
            resolve({ success: false, error: `plan_writer_runner.py exited with code ${code}` });
          } else {
            resolve({ success: true, data: undefined });
          }
        });

        child.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      });
    }
  );

  // ============================================================
  // PIPELINE_GET_FUNCTIONAL_PLAN
  // Reads functional_plan.md from the given specDir and returns
  // its contents as a string.
  // ============================================================
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_GET_FUNCTIONAL_PLAN,
    async (_, specDir: string): Promise<IPCResult<string>> => {
      const planPath = path.join(specDir, 'functional_plan.md');
      if (!existsSync(planPath)) {
        return { success: false, error: `functional_plan.md not found at: ${planPath}` };
      }
      try {
        const content = readFileSync(planPath, 'utf-8');
        return { success: true, data: content };
      } catch (err) {
        return { success: false, error: `Failed to read functional_plan.md: ${String(err)}` };
      }
    }
  );

  // ============================================================
  // PIPELINE_FINISH
  // Spawns finisher_runner.py, streams JSON-lines progress via
  // PIPELINE_FINISH_PROGRESS to the renderer.
  // ============================================================
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_FINISH,
    async (
      _,
      payload: {
        action: 'test' | 'pr' | 'merge';
        spec_dir: string;
        project_dir: string;
        pr_title?: string | null;
      }
    ): Promise<IPCResult<void>> => {
      const envCheck = await agentManager.ensurePythonEnvReady();
      if (!envCheck.ready) {
        return { success: false, error: `Python environment not ready: ${envCheck.error}` };
      }

      const scriptPath = resolveRunnerPath(agentManager, 'finisher_runner.py');
      if (!scriptPath) {
        return { success: false, error: 'Cannot locate backend source directory' };
      }

      const pythonPath = agentManager.getPythonPath();
      const [pythonCmd, pythonBaseArgs] = parsePythonCommand(pythonPath);
      const spawnEnv = buildSpawnEnv(agentManager);

      return new Promise((resolve) => {
        const child = spawn(pythonCmd, [...pythonBaseArgs, scriptPath], {
          cwd: payload.project_dir,
          env: spawnEnv,
        });

        let stdoutBuf = '';

        // Write payload to stdin and close it
        try {
          child.stdin?.write(JSON.stringify(payload));
          child.stdin?.end();
        } catch (err) {
          resolve({ success: false, error: String(err) });
          return;
        }

        child.stdout?.on('data', (chunk: Buffer) => {
          stdoutBuf += chunk.toString('utf-8');
          const lines = stdoutBuf.split('\n');
          stdoutBuf = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed);
              safeSendToRenderer(getMainWindow, IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, event);
            } catch {
              // Non-JSON line — ignore
            }
          }
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          console.debug('[PipelineHandlers finisher stderr]', chunk.toString('utf-8').trimEnd());
        });

        child.on('exit', (code) => {
          // Flush remaining buffer
          if (stdoutBuf.trim()) {
            try {
              const event = JSON.parse(stdoutBuf.trim());
              safeSendToRenderer(getMainWindow, IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, event);
            } catch {
              // Ignore malformed final line
            }
          }
          if (code !== 0) {
            resolve({ success: false, error: `finisher_runner.py exited with code ${code}` });
          } else {
            resolve({ success: true, data: undefined });
          }
        });

        child.on('error', (err) => {
          resolve({ success: false, error: err.message });
        });
      });
    }
  );

  // ============================================================
  // PIPELINE_VISUAL_COMPANION_STOP
  // Stops the Visual Companion server for the given taskId.
  // ============================================================
  ipcMain.handle(
    IPC_CHANNELS.PIPELINE_VISUAL_COMPANION_STOP,
    async (_, taskId: string): Promise<IPCResult<void>> => {
      stopVisualSession(taskId);
      return { success: true, data: undefined };
    }
  );
}
