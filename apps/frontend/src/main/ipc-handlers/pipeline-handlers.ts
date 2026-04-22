import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
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
      payload: { messages: Array<{ role: string; content: string }>; project_dir: string }
    ): Promise<IPCResult<{ response: string; ready_to_plan: boolean; spec_summary: string | null }>> => {
      // Ensure Python venv is ready before spawning
      const envCheck = await agentManager.ensurePythonEnvReady();
      if (!envCheck.ready) {
        return { success: false, error: `Python environment not ready: ${envCheck.error}` };
      }

      const scriptPath = resolveRunnerPath(agentManager, 'brainstorm_runner.py');
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
        let timedOut = false;

        const timeout = setTimeout(() => {
          timedOut = true;
          child.kill();
          resolve({ success: false, error: 'brainstorm_runner.py timed out after 60s' });
        }, 60_000);

        // Write payload to stdin and close it
        try {
          child.stdin?.write(JSON.stringify(payload));
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
            resolve({ success: true, data });
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
}
