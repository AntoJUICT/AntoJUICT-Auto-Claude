/**
 * Task status utility functions
 */

import type { TaskStatus } from '../types';

/**
 * Checks if a task is in a completed state.
 * Completed tasks are those in 'done' or 'pr_ready' status,
 * or 'preview' status (task ready for review/merge).
 *
 * @param status - The task status to check
 * @returns true if the task is completed, false otherwise
 */
export function isCompletedTask(status: TaskStatus): boolean {
  return status === 'done' || status === 'pr_ready' || status === 'preview';
}
