/**
 * Pipeline API
 *
 * Preload API for the spec brainstorm / plan-writing / finisher pipeline.
 * Exposes IPC methods to the renderer via window.electronAPI.pipeline.
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

export interface PipelinePlanProgressEvent {
  status: string;
  message: string;
}

export interface PipelineFinishProgressEvent {
  status: string;
  message: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Brainstorm response type
// ---------------------------------------------------------------------------

export interface BrainstormResponse {
  response: string;
  ready_to_plan: boolean;
  spec_summary: string | null;
}

// ---------------------------------------------------------------------------
// API interface
// ---------------------------------------------------------------------------

export interface PipelineAPI {
  /**
   * Send a brainstorm chat message and receive a single AI response.
   * Returns the assistant reply, a readiness flag, and an optional spec summary.
   */
  sendBrainstormMessage: (
    messages: Array<{ role: string; content: string }>,
    projectDir: string
  ) => Promise<IPCResult<BrainstormResponse>>;

  /**
   * Stream plan-writing progress.
   * Progress events are emitted via onPlanProgress while the plan is generated.
   */
  writePlan: (
    specSummary: string,
    specDir: string,
    projectDir: string
  ) => Promise<IPCResult<void>>;

  /**
   * Read functional_plan.md from specDir and return its content.
   */
  getFunctionalPlan: (specDir: string) => Promise<IPCResult<string>>;

  /**
   * Run the finisher (test / pr / merge) and stream progress events.
   */
  finish: (
    action: 'test' | 'pr' | 'merge',
    specDir: string,
    projectDir: string,
    prTitle?: string
  ) => Promise<IPCResult<void>>;

  /**
   * Listen for plan-writing progress events.
   * Returns an unsubscribe function.
   */
  onPlanProgress: (
    callback: (event: PipelinePlanProgressEvent) => void
  ) => () => void;

  /**
   * Listen for finisher progress events.
   * Returns an unsubscribe function.
   */
  onFinishProgress: (
    callback: (event: PipelineFinishProgressEvent) => void
  ) => () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export const createPipelineAPI = (): PipelineAPI => ({
  sendBrainstormMessage: (
    messages: Array<{ role: string; content: string }>,
    projectDir: string
  ): Promise<IPCResult<BrainstormResponse>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_BRAINSTORM_MESSAGE, {
      messages,
      project_dir: projectDir,
    }),

  writePlan: (
    specSummary: string,
    specDir: string,
    projectDir: string
  ): Promise<IPCResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_WRITE_PLAN, {
      spec_summary: specSummary,
      spec_dir: specDir,
      project_dir: projectDir,
    }),

  getFunctionalPlan: (specDir: string): Promise<IPCResult<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_GET_FUNCTIONAL_PLAN, specDir),

  finish: (
    action: 'test' | 'pr' | 'merge',
    specDir: string,
    projectDir: string,
    prTitle?: string
  ): Promise<IPCResult<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_FINISH, {
      action,
      spec_dir: specDir,
      project_dir: projectDir,
      pr_title: prTitle ?? null,
    }),

  onPlanProgress: (
    callback: (event: PipelinePlanProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: PipelinePlanProgressEvent
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_PLAN_PROGRESS, handler);
  },

  onFinishProgress: (
    callback: (event: PipelineFinishProgressEvent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: PipelineFinishProgressEvent
    ) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PIPELINE_FINISH_PROGRESS, handler);
  },
});
