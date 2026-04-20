import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc';

export interface PreviewAPI {
  start: (taskId: string, worktreePath: string, command: string) => Promise<{ port: number; url: string }>;
  stop: (taskId: string) => Promise<void>;
  status: (taskId: string) => Promise<{ status: string; port: number | null; url: string | null; lastError: string | null }>;
  detect: (projectPath: string) => Promise<string | null>;
  keepAlive: (taskId: string) => Promise<void>;
}

export const createPreviewAPI = (): PreviewAPI => ({
  start: (taskId: string, worktreePath: string, command: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_START, taskId, worktreePath, command),
  stop: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_STOP, taskId),
  status: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_STATUS, taskId),
  detect: (projectPath: string) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_DETECT, projectPath),
  keepAlive: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_KEEP_ALIVE, taskId),
});
