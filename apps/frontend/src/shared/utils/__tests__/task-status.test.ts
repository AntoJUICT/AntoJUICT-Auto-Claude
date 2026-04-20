import { describe, expect, it } from 'vitest';
import { isCompletedTask } from '../task-status';
import type { TaskStatus } from '../../types';

describe('isCompletedTask', () => {
  describe('completed statuses', () => {
    it('should return true for "done" status', () => {
      expect(isCompletedTask('done')).toBe(true);
    });

    it('should return true for "pr_ready" status', () => {
      expect(isCompletedTask('pr_ready')).toBe(true);
    });

    it('should return true for "preview" status (task ready for review/merge)', () => {
      expect(isCompletedTask('preview')).toBe(true);
    });
  });

  describe('non-completed statuses', () => {
    it('should return false for "backlog" status', () => {
      expect(isCompletedTask('backlog')).toBe(false);
    });

    it('should return false for "brainstorming" status', () => {
      expect(isCompletedTask('brainstorming')).toBe(false);
    });

    it('should return false for "spec_review" status', () => {
      expect(isCompletedTask('spec_review')).toBe(false);
    });

    it('should return false for "planning" status', () => {
      expect(isCompletedTask('planning')).toBe(false);
    });

    it('should return false for "plan_review" status', () => {
      expect(isCompletedTask('plan_review')).toBe(false);
    });

    it('should return false for "in_progress" status', () => {
      expect(isCompletedTask('in_progress')).toBe(false);
    });

    it('should return false for "error" status', () => {
      expect(isCompletedTask('error')).toBe(false);
    });
  });

  describe('archived task considerations', () => {
    it('should return true for archived tasks with "done" status', () => {
      // Archived tasks with 'done' status are still considered completed
      // (archivedAt is metadata, not status)
      expect(isCompletedTask('done')).toBe(true);
    });

    it('should return true for archived tasks with "pr_ready" status', () => {
      expect(isCompletedTask('pr_ready')).toBe(true);
    });

    it('should return false for archived tasks with other statuses', () => {
      expect(isCompletedTask('backlog')).toBe(false);
      expect(isCompletedTask('error')).toBe(false);
      expect(isCompletedTask('in_progress')).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should work with explicit TaskStatus type annotation', () => {
      const status: TaskStatus = 'done';
      expect(isCompletedTask(status)).toBe(true);
    });

    it('should correctly handle all valid TaskStatus values', () => {
      const allStatuses: TaskStatus[] = [
        'backlog',
        'brainstorming',
        'spec_review',
        'planning',
        'plan_review',
        'in_progress',
        'preview',
        'pr_ready',
        'done',
        'error',
      ];

      const completedStatuses = allStatuses.filter((status) => isCompletedTask(status));
      expect(completedStatuses).toEqual(['preview', 'pr_ready', 'done']);
    });
  });

  describe('real-world scenarios', () => {
    it('should identify tasks ready for changelog inclusion', () => {
      expect(isCompletedTask('done')).toBe(true);
      expect(isCompletedTask('pr_ready')).toBe(true);
      expect(isCompletedTask('preview')).toBe(true);
    });

    it('should exclude tasks still in progress from completed count', () => {
      expect(isCompletedTask('in_progress')).toBe(false);
      expect(isCompletedTask('planning')).toBe(false);
    });

    it('should exclude tasks in error state', () => {
      expect(isCompletedTask('error')).toBe(false);
    });

    it('should exclude tasks in backlog', () => {
      expect(isCompletedTask('backlog')).toBe(false);
    });
  });

  describe('boundary conditions', () => {
    it('should handle status in conditional expressions', () => {
      const statuses: TaskStatus[] = ['done', 'in_progress', 'pr_ready'];
      const completed = statuses.filter((s) => isCompletedTask(s));
      expect(completed).toHaveLength(2);
      expect(completed).toContain('done');
      expect(completed).toContain('pr_ready');
      expect(completed).not.toContain('in_progress');
    });

    it('should work in array methods with task objects', () => {
      const tasks = [
        { id: '1', status: 'done' as TaskStatus },
        { id: '2', status: 'in_progress' as TaskStatus },
        { id: '3', status: 'pr_ready' as TaskStatus },
        { id: '4', status: 'error' as TaskStatus },
        { id: '5', status: 'preview' as TaskStatus },
        { id: '6', status: 'backlog' as TaskStatus },
      ];

      const completedTasks = tasks.filter((task) => isCompletedTask(task.status));
      expect(completedTasks).toHaveLength(3);
      expect(completedTasks.map((t) => t.id)).toEqual(['1', '3', '5']);
    });

    it('should be usable in reduce operations', () => {
      const tasks = [
        { status: 'done' as TaskStatus },
        { status: 'in_progress' as TaskStatus },
        { status: 'pr_ready' as TaskStatus },
        { status: 'backlog' as TaskStatus },
        { status: 'done' as TaskStatus },
        { status: 'preview' as TaskStatus },
      ];

      const completedCount = tasks.reduce(
        (count, task) => (isCompletedTask(task.status) ? count + 1 : count),
        0,
      );

      expect(completedCount).toBe(4);
    });
  });
});
