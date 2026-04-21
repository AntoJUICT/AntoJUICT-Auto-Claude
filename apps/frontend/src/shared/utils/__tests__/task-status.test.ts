import { describe, expect, it } from 'vitest';
import { isCompletedTask } from '../task-status';
import type { TaskStatus } from '../../types';

describe('isCompletedTask', () => {
  describe('completed statuses', () => {
    it('should return true for "done" status', () => {
      expect(isCompletedTask('done')).toBe(true);
    });

    it('should return true for "verifying" status (task ready for review/merge)', () => {
      expect(isCompletedTask('verifying')).toBe(true);
    });
  });

  describe('non-completed statuses', () => {
    it('should return false for "inbox" status', () => {
      expect(isCompletedTask('inbox')).toBe(false);
    });

    it('should return false for "brainstorming" status', () => {
      expect(isCompletedTask('brainstorming')).toBe(false);
    });

    it('should return false for "planning" status', () => {
      expect(isCompletedTask('planning')).toBe(false);
    });

    it('should return false for "executing" status', () => {
      expect(isCompletedTask('executing')).toBe(false);
    });
  });

  describe('archived task considerations', () => {
    it('should return true for archived tasks with "done" status', () => {
      // Archived tasks with 'done' status are still considered completed
      // (archivedAt is metadata, not status)
      expect(isCompletedTask('done')).toBe(true);
    });

    it('should return true for archived tasks with "verifying" status', () => {
      expect(isCompletedTask('verifying')).toBe(true);
    });

    it('should return false for archived tasks with other statuses', () => {
      expect(isCompletedTask('inbox')).toBe(false);
      expect(isCompletedTask('executing')).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should work with explicit TaskStatus type annotation', () => {
      const status: TaskStatus = 'done';
      expect(isCompletedTask(status)).toBe(true);
    });

    it('should correctly handle all valid TaskStatus values', () => {
      const allStatuses: TaskStatus[] = [
        'inbox',
        'brainstorming',
        'planning',
        'executing',
        'verifying',
        'done',
      ];

      const completedStatuses = allStatuses.filter((status) => isCompletedTask(status));
      expect(completedStatuses).toEqual(['verifying', 'done']);
    });
  });

  describe('real-world scenarios', () => {
    it('should identify tasks ready for changelog inclusion', () => {
      expect(isCompletedTask('done')).toBe(true);
      expect(isCompletedTask('verifying')).toBe(true);
    });

    it('should exclude tasks still in progress from completed count', () => {
      expect(isCompletedTask('executing')).toBe(false);
      expect(isCompletedTask('planning')).toBe(false);
    });

    it('should exclude tasks in inbox state', () => {
      expect(isCompletedTask('inbox')).toBe(false);
    });

    it('should exclude tasks in inbox', () => {
      expect(isCompletedTask('inbox')).toBe(false);
    });
  });

  describe('boundary conditions', () => {
    it('should handle status in conditional expressions', () => {
      const statuses: TaskStatus[] = ['done', 'executing', 'verifying'];
      const completed = statuses.filter((s) => isCompletedTask(s));
      expect(completed).toHaveLength(2);
      expect(completed).toContain('done');
      expect(completed).toContain('verifying');
      expect(completed).not.toContain('executing');
    });

    it('should work in array methods with task objects', () => {
      const tasks = [
        { id: '1', status: 'done' as TaskStatus },
        { id: '2', status: 'executing' as TaskStatus },
        { id: '3', status: 'verifying' as TaskStatus },
        { id: '4', status: 'inbox' as TaskStatus },
        { id: '5', status: 'brainstorming' as TaskStatus },
      ];

      const completedTasks = tasks.filter((task) => isCompletedTask(task.status));
      expect(completedTasks).toHaveLength(2);
      expect(completedTasks.map((t) => t.id)).toEqual(['1', '3']);
    });

    it('should be usable in reduce operations', () => {
      const tasks = [
        { status: 'done' as TaskStatus },
        { status: 'executing' as TaskStatus },
        { status: 'verifying' as TaskStatus },
        { status: 'inbox' as TaskStatus },
        { status: 'done' as TaskStatus },
        { status: 'verifying' as TaskStatus },
      ];

      const completedCount = tasks.reduce(
        (count, task) => (isCompletedTask(task.status) ? count + 1 : count),
        0,
      );

      expect(completedCount).toBe(4);
    });
  });
});
