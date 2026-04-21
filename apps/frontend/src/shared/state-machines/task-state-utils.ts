/**
 * Shared XState task state utilities.
 *
 * Provides type-safe state names, phase mappings, and legacy status conversion
 * derived from the task machine definition. Used by task-state-manager and
 * agent-events-handlers to avoid duplicate constants.
 */
import type { TaskStatus, ExecutionPhase } from '../types';

/**
 * All XState task state names.
 *
 * IMPORTANT: These must match the state keys in task-machine.ts.
 * If you add/remove a state in the machine, update this array.
 */
export const TASK_STATE_NAMES = [
  'backlog', 'planning', 'plan_review', 'coding',
  'qa_review', 'qa_fixing', 'preview', 'error',
  'creating_pr', 'pr_ready', 'done'
] as const;

export type TaskStateName = typeof TASK_STATE_NAMES[number];

/**
 * XState states where the task has "settled" — the state machine has determined
 * the task's final or review status. Execution-progress events from the agent
 * process should NOT overwrite these states, as XState is the source of truth.
 *
 * Note: `error` is included because stale execution-progress events (e.g.,
 * phase='failed') may arrive after XState has already transitioned to error.
 * When a user resumes from error (USER_RESUMED), XState transitions synchronously
 * to `coding` before the new agent process emits events, so the guard no longer
 * blocks — new execution-progress events flow through normally.
 */
export const XSTATE_SETTLED_STATES: ReadonlySet<string> = new Set<TaskStateName>([
  'plan_review', 'preview', 'error', 'creating_pr', 'pr_ready', 'done'
]);

/** Maps XState states to execution phases. */
export const XSTATE_TO_PHASE: Record<TaskStateName, ExecutionPhase> & Record<string, ExecutionPhase | undefined> = {
  'backlog': 'idle',
  'planning': 'planning',
  'plan_review': 'planning',
  'coding': 'coding',
  'qa_review': 'qa_review',
  'qa_fixing': 'qa_fixing',
  'preview': 'complete',
  'error': 'failed',
  'creating_pr': 'complete',
  'pr_ready': 'complete',
  'done': 'complete'
};

/**
 * Convert XState state to TaskStatus.
 */
export function mapStateToStatus(state: string): TaskStatus {
  switch (state) {
    case 'backlog':
      return 'inbox';
    case 'planning':
    case 'coding':
      return 'executing';
    case 'plan_review':
      return 'planning';
    case 'qa_review':
    case 'qa_fixing':
      return 'executing';
    case 'preview':
      return 'verifying';
    case 'error':
      return 'inbox';
    case 'creating_pr':
      return 'verifying';
    case 'pr_ready':
      return 'done';
    case 'done':
      return 'done';
    default:
      return 'inbox';
  }
}

/**
 * @deprecated Use mapStateToStatus instead.
 * Convert XState state to legacy status pair (kept for backward compat).
 */
export function mapStateToLegacy(
  state: string
): { status: TaskStatus } {
  return { status: mapStateToStatus(state) };
}
