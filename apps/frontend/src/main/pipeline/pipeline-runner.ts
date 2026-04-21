import { spawn } from 'child_process';
import path from 'path';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@shared/constants/ipc';
import type { TaskStatus } from '@shared/types/task';
import { parsePythonCommand } from '../python-detector';
import { persistPlanStatusAndReasonSync } from '../ipc-handlers/task/plan-file-utils';

interface PipelineProcessConfig {
  getPythonPath: () => string;
  getAutoBuildSourcePath: () => string | null;
  ensurePythonEnvReady: () => Promise<{ ready: boolean; error?: string }>;
  getSpawnEnv: () => NodeJS.ProcessEnv;
}

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
  specId: string;
  projectPath: string;
  planPath: string;
  phase: PipelinePhase;
  subtaskIndex: number;
  totalSubtasks: number;
  modelOverride?: string;
  taskTitle?: string;
  taskDescription?: string;
}

const activePipelines = new Map<string, PipelineTask>();

let _config: PipelineProcessConfig | null = null;

/** Called once from registerTaskExecutionHandlers to inject process config. */
export function configure(config: PipelineProcessConfig): void {
  _config = config;
}

export function startPipeline(
  window: BrowserWindow,
  taskId: string,
  specId: string,
  projectPath: string,
  planPath: string,
  modelOverride?: string,
  taskTitle?: string,
  taskDescription?: string
): void {
  const task: PipelineTask = {
    taskId,
    specId,
    projectPath,
    planPath,
    phase: 'brainstorming',
    subtaskIndex: 0,
    totalSubtasks: 0,
    modelOverride,
    taskTitle,
    taskDescription,
  };
  activePipelines.set(taskId, task);
  emitStatusChange(window, taskId, 'brainstorming');
  runPhase(window, task, 'brainstorming').catch((err) => {
    console.error('[PipelineRunner] startPipeline error:', err);
    emitStatusChange(window, taskId, 'inbox');
  });
}

export function approveSpec(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'spec_review') return;
  task.phase = 'planning';
  emitStatusChange(window, taskId, 'planning');
  runPhase(window, task, 'planning').catch((err) => {
    console.error('[PipelineRunner] approveSpec error:', err);
    emitStatusChange(window, taskId, 'inbox');
  });
}

export function approvePlan(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'plan_review') return;
  task.phase = 'in_progress';
  emitStatusChange(window, taskId, 'executing');
  runPhase(window, task, 'implementation').catch((err) => {
    console.error('[PipelineRunner] approvePlan error:', err);
    emitStatusChange(window, taskId, 'inbox');
  });
}

export function approvePreview(window: BrowserWindow, taskId: string): void {
  const task = activePipelines.get(taskId);
  if (!task || task.phase !== 'preview') return;
  task.phase = 'pr_ready';
  emitStatusChange(window, taskId, 'done');
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
  const pythonPhase = target === 'spec_review' ? 'brainstorming' : 'planning';
  task.phase = nextPhase;
  emitStatusChange(window, taskId, nextPhase);
  runPhase(window, task, pythonPhase, note).catch((err) => {
    console.error('[PipelineRunner] sendBack error:', err);
    emitStatusChange(window, taskId, 'inbox');
  });
}

function emitStatusChange(window: BrowserWindow, taskId: string, status: TaskStatus): void {
  // Send as separate args to match the preload handler signature: (taskId, status, projectId?)
  window.webContents.send(IPC_CHANNELS.TASK_STATUS_CHANGE, taskId, status);
  // Persist to disk so page refresh reflects the correct status (not stale 'backlog')
  const task = activePipelines.get(taskId);
  if (task) {
    persistPlanStatusAndReasonSync(task.planPath, status);
  }
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

async function runPhase(
  window: BrowserWindow,
  task: PipelineTask,
  phase: 'brainstorming' | 'planning' | 'implementation',
  sendBackNote?: string
): Promise<void> {
  if (!_config) {
    console.error('[PipelineRunner] Not configured — call configure() first');
    return;
  }

  // Wait for the Python venv to be ready before spawning — same as agentManager does.
  // Without this, getPythonPath() may return the system Python before the venv is initialized.
  const envCheck = await _config.ensurePythonEnvReady();
  if (!envCheck.ready) {
    console.error('[PipelineRunner] Python environment not ready:', envCheck.error);
    emitStatusChange(window, task.taskId, 'inbox');
    return;
  }

  const backendSource = _config.getAutoBuildSourcePath();
  if (!backendSource) {
    console.error('[PipelineRunner] Cannot locate backend source directory');
    emitStatusChange(window, task.taskId, 'inbox');
    return;
  }

  const scriptPath = path.join(backendSource, 'runners', 'pipeline_runner.py');
  const pythonPath = _config.getPythonPath();
  const [pythonCmd, pythonBaseArgs] = parsePythonCommand(pythonPath);

  const args: string[] = [
    scriptPath,
    '--phase', phase,
    '--task-id', task.taskId,
    '--spec-id', task.specId,
    '--project-dir', task.projectPath,
  ];
  if (task.taskTitle) {
    args.push('--task-title', task.taskTitle);
  }
  if (task.taskDescription) {
    args.push('--task-description', task.taskDescription);
  }
  if (task.modelOverride) {
    args.push('--model', task.modelOverride);
  }
  if (sendBackNote) {
    args.push('--send-back-note', sendBackNote);
  }

  const spawnEnv = _config.getSpawnEnv();

  const child = spawn(pythonCmd, [...pythonBaseArgs, ...args], {
    cwd: task.projectPath,
    env: spawnEnv,
  });

  let stdoutBuf = '';

  const processLine = (line: string) => {
    const TASK_EVENT_PREFIX = '__TASK_EVENT__:';
    const PHASE_PREFIX = '__EXEC_PHASE__:';

    if (line.includes(TASK_EVENT_PREFIX)) {
      const jsonStart = line.indexOf(TASK_EVENT_PREFIX) + TASK_EVENT_PREFIX.length;
      try {
        const event = JSON.parse(line.slice(jsonStart));
        handleTaskEvent(window, task, event);
      } catch {
        // malformed JSON — ignore
      }
      return;
    }

    if (line.includes(PHASE_PREFIX)) {
      const jsonStart = line.indexOf(PHASE_PREFIX) + PHASE_PREFIX.length;
      try {
        const phaseEvent = JSON.parse(line.slice(jsonStart));
        window.webContents.send(IPC_CHANNELS.TASK_EXECUTION_PROGRESS, {
          taskId: task.taskId,
          executionProgress: {
            phase: phaseEvent.phase,
            phaseProgress: phaseEvent.progress ?? 50,
            overallProgress: phaseEvent.progress ?? 50,
            message: phaseEvent.message,
            sequenceNumber: Date.now(),
          },
        });
      } catch {
        // malformed JSON — ignore
      }
    }
  };

  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf-8');
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() ?? '';
    for (const line of lines) {
      processLine(line);
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    // Log stderr to console for diagnostics; don't parse as events
    console.debug('[PipelineRunner stderr]', chunk.toString('utf-8').trimEnd());
  });

  child.on('exit', (code) => {
    // Flush remaining buffer
    if (stdoutBuf.trim()) processLine(stdoutBuf);

    if (code !== 0) {
      console.error(`[PipelineRunner] Phase ${phase} exited with code ${code} for task ${task.taskId}`);
      emitStatusChange(window, task.taskId, 'inbox');
    }
  });
}

function handleTaskEvent(
  window: BrowserWindow,
  task: PipelineTask,
  event: { type: string; subtaskIndex?: number; total?: number; agentPhase?: string }
): void {
  switch (event.type) {
    case 'BRAINSTORMING_COMPLETE':
      task.phase = 'spec_review';
      emitStatusChange(window, task.taskId, 'brainstorming');
      break;

    case 'PLANNING_COMPLETE':
      task.totalSubtasks = (event as { subtaskCount?: number }).subtaskCount ?? 0;
      task.phase = 'plan_review';
      emitStatusChange(window, task.taskId, 'planning');
      break;

    case 'SUBTASK_STARTED': {
      const idx = event.subtaskIndex ?? 0;
      const total = event.total ?? task.totalSubtasks;
      const agentPhase = (event.agentPhase ?? 'implementing') as
        'implementing' | 'spec_review' | 'quality_review' | 'done' | 'failed';
      task.subtaskIndex = idx;
      emitSubtaskProgress(window, task.taskId, idx, total, agentPhase);
      break;
    }

    case 'SUBTASK_COMPLETED':
      task.subtaskIndex = (event.subtaskIndex ?? 0) + 1;
      break;

    case 'ALL_SUBTASKS_DONE':
      task.phase = 'preview';
      emitStatusChange(window, task.taskId, 'verifying');
      break;

    case 'IMPLEMENTATION_FAILED':
    case 'PIPELINE_ERROR':
      task.phase = 'error';
      emitStatusChange(window, task.taskId, 'inbox');
      break;

    default:
      break;
  }
}
