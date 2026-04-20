import { ipcRenderer } from 'electron';

export interface PreviewAPI {
  start: (taskId: string, worktreePath: string, command: string) => Promise<{ port: number; url: string }>;
  stop: (taskId: string) => Promise<void>;
  status: (taskId: string) => Promise<{ status: string; port: number | null; url: string | null; lastError: string | null }>;
  detect: (projectPath: string) => Promise<string | null>;
  keepAlive: (taskId: string) => Promise<void>;
}

export const createPreviewAPI = (): PreviewAPI => ({
  start: (taskId: string, worktreePath: string, command: string) =>
    ipcRenderer.invoke('preview:start', taskId, worktreePath, command),
  stop: (taskId: string) => ipcRenderer.invoke('preview:stop', taskId),
  status: (taskId: string) => ipcRenderer.invoke('preview:status', taskId),
  detect: (projectPath: string) => ipcRenderer.invoke('preview:detect', projectPath),
  keepAlive: (taskId: string) => ipcRenderer.invoke('preview:keepAlive', taskId),
});
