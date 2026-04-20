import { ipcMain, shell } from 'electron';
import {
  startPreview,
  stopPreview,
  getPreviewStatus,
  keepAlive,
  detectDevCommand,
} from '../preview';

export function setupPreviewHandlers(): void {
  ipcMain.handle('preview:start', async (_event, taskId: string, worktreePath: string, command: string) => {
    const result = await startPreview(taskId, worktreePath, command);
    shell.openExternal(result.url);
    return result;
  });

  ipcMain.handle('preview:stop', async (_event, taskId: string) => {
    stopPreview(taskId);
  });

  ipcMain.handle('preview:status', async (_event, taskId: string) => {
    return getPreviewStatus(taskId);
  });

  ipcMain.handle('preview:detect', async (_event, projectPath: string) => {
    return detectDevCommand(projectPath);
  });

  ipcMain.handle('preview:keepAlive', async (_event, taskId: string) => {
    keepAlive(taskId);
  });
}
