import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import type { TaskStatus } from '@shared/types/task';

export type PipelinePhase =
  | 'brainstorming'
  | 'spec_review'
  | 'planning'
  | 'plan_review'
  | 'in_progress'
  | 'preview'
  | 'pr_ready'
  | 'done'
  | 'error';

interface PipelineTask {
  taskId: string;
  projectPath: string;
  phase: PipelinePhase;
  subtaskIndex: number;
  totalSubtasks: number;
  modelOverride?: string;
}

const activePipelines = new Map<string, PipelineTask>();

export function startPipeline(
  window: BrowserWindow,
  taskId: string,
  projectPath: string,
  modelOverride?: string
): void {
  const task: PipelineTask = {
    taskId,
    projectPath,
    phase: 'brainstorming',
    subtaskIndex: 0,
    totalSubtasks: 0,
    modelOverride,
  };
  activePipelines.set(taskId, task);
  emitStatusChange(window, taskId, 'brainstorming');
  runBrainstormingPhase(window, task);
}

export function approveSpec(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'spec_review') return;
  task.phase = 'planning';
  emitStatusChange(window, taskId, 'planning');
  runPlanningPhase(window, task);
}

export function approvePlan(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'plan_review') return;
  task.phase = 'in_progress';
  emitStatusChange(window, taskId, 'in_progress');
  runImplementationPhase(window, task);
}

export function approvePreview(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'preview') return;
  task.phase = 'pr_ready';
  emitStatusChange(window, taskId, 'pr_ready');
}

export function sendBack(
  window: BrowserWindow,
  taskId: string,
  target: 'spec_review' | 'plan_review',
  note?: string
): void {
  const task = activePipelines.get(taskId);
  if (!task) return;
  const nextPhase: PipelinePhase = target === 'spec_review' ? 'brainstorming' : 'planning';
  task.phase = nextPhase;
  emitStatusChange(window, taskId, nextPhase);
  if (nextPhase === 'brainstorming') runBrainstormingPhase(window, task, note);
  else runPlanningPhase(window, task);
}

function emitStatusChange(window: BrowserWindow, taskId: string, status: TaskStatus): void {
  window.webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGE, { taskId, status });
}

export function emitSubtaskProgress(
  window: BrowserWindow,
  taskId: string,
  currentIndex: number,
  total: number,
  agentPhase: 'implementing' | 'spec_review' | 'quality_review' | 'done' | 'failed'
): void {
  window.webContents.send(IPC_CHANNELS.TASK_EXECUTION_PROGRESS, {
    taskId,
    executionProgress: {
      phase: 'coding',
      phaseProgress: Math.round((currentIndex / total) * 100),
      overallProgress: Math.round(20 + (currentIndex / total) * 60),
      subtaskProgress: { currentIndex, total, agentPhase },
    },
  });
}

function runBrainstormingPhase(window: BrowserWindow, task: PipelineTask, _note?: string): void {
  // Placeholder: real implementation spawns Python brainstorming agent subprocess
  task.phase = 'spec_review';
  emitStatusChange(window, task.taskId, 'spec_review');
}

function runPlanningPhase(window: BrowserWindow, task: PipelineTask): void {
  // Placeholder: real implementation spawns Python planning agent subprocess
  task.phase = 'plan_review';
  emitStatusChange(window, task.taskId, 'plan_review');
}

function runImplementationPhase(window: BrowserWindow, task: PipelineTask): void {
  // Placeholder: real implementation runs per-subtask implementer loop
  task.phase = 'preview';
  emitStatusChange(window, task.taskId, 'preview');
}
