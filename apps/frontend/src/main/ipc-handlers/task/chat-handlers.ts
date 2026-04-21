import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { IPCResult } from '../../../shared/types';
import { pythonEnvManager, getConfiguredPythonPath } from '../../python-env-manager';
import { parsePythonCommand } from '../../python-detector';
import { getBestAvailableProfileEnv } from '../../rate-limit-detector';
import { getAPIProfileEnv } from '../../services/profile';
import { getOAuthModeClearVars } from '../../agent/env-utils';
import { getEffectiveSourcePath } from '../../updater/path-resolver';
import { getSentryEnvForSubprocess } from '../../sentry';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  done: boolean;
  question?: string;
  description?: string;
}

export function registerTaskChatHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.TASK_CHAT_MESSAGE,
    async (
      _,
      messages: ChatMessage[]
    ): Promise<IPCResult<ChatResponse>> => {
      const sourcePath = getEffectiveSourcePath();
      const runnerPath = path.join(sourcePath, 'runners', 'task_chat_runner.py');
      const pythonPath = getConfiguredPythonPath();
      const [pythonCmd, pythonArgs] = parsePythonCommand(pythonPath);

      if (!pythonEnvManager.isEnvReady()) {
        return {
          success: false,
          error: 'Python environment not ready'
        };
      }

      const apiProfileEnv = await getAPIProfileEnv();
      const isApiProfileActive = Object.keys(apiProfileEnv).length > 0;
      let profileEnv: Record<string, string> = {};
      if (!isApiProfileActive) {
        const result = getBestAvailableProfileEnv();
        profileEnv = result.env;
      }
      const oauthModeClearVars = getOAuthModeClearVars(apiProfileEnv);

      return new Promise((resolve) => {
        const child = spawn(
          pythonCmd,
          [...pythonArgs, runnerPath],
          {
            cwd: sourcePath,
            env: {
              ...pythonEnvManager.getPythonEnv(),
              ...getSentryEnvForSubprocess(),
              ...profileEnv,
              ...apiProfileEnv,
              ...oauthModeClearVars,
              PYTHONUNBUFFERED: '1',
            },
          }
        );

        let stdout = '';
        let stderr = '';

        const timeout = setTimeout(() => {
          child.kill();
          resolve({ success: false, error: 'Chat request timed out' });
        }, 30000);

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf-8');
        });

        child.stderr?.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });

        child.on('exit', (code) => {
          clearTimeout(timeout);
          if (code === 0 && stdout.trim()) {
            try {
              const parsed: ChatResponse = JSON.parse(stdout.trim());
              resolve({ success: true, data: parsed });
            } catch {
              resolve({ success: false, error: 'Invalid JSON from chat runner' });
            }
          } else {
            console.warn('[TASK_CHAT] Runner failed:', { code, stderr: stderr.substring(0, 300) });
            resolve({ success: false, error: stderr.substring(0, 200) || 'Chat runner error' });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });

        // Write conversation to stdin
        child.stdin?.write(JSON.stringify({ messages }));
        child.stdin?.end();
      });
    }
  );
}
