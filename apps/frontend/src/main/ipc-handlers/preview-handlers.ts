import { ipcMain } from 'electron';
import {
  startPreview,
  stopPreview,
  getPreviewStatus,
  keepAlive,
  detectDevCommand,
} from '../preview';
import { IPC_CHANNELS } from '@shared/constants/ipc';

export function registerPreviewHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PREVIEW_START, async (_event, taskId: string, worktreePath: string, command: string) => {
    try {
      return await startPreview(taskId, worktreePath, command);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_STOP, async (_event, taskId: string) => {
    try {
      stopPreview(taskId);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_STATUS, async (_event, taskId: string) => {
    try {
      return getPreviewStatus(taskId);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_DETECT, async (_event, projectPath: string) => {
    try {
      return detectDevCommand(projectPath);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREVIEW_KEEP_ALIVE, async (_event, taskId: string) => {
    try {
      keepAlive(taskId);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
