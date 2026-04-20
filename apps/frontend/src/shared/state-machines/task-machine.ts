import { assign, createMachine } from 'xstate';

export interface TaskContext {
  error?: string;
}

export type TaskEvent =
  | { type: 'PLANNING_STARTED' }
  | {
      type: 'PLANNING_COMPLETE';
      hasSubtasks: boolean;
      subtaskCount: number;
      requireReviewBeforeCoding: boolean;
    }
  | { type: 'PLAN_APPROVED' }
  | { type: 'CODING_STARTED'; subtaskId: string; subtaskDescription: string }
  | { type: 'SUBTASK_COMPLETED'; subtaskId: string; completedCount: number; totalCount: number }
  | { type: 'ALL_SUBTASKS_DONE'; totalCount: number }
  | { type: 'QA_STARTED'; iteration: number; maxIterations: number }
  | { type: 'QA_PASSED'; iteration: number; testsRun: Record<string, unknown> }
  | { type: 'QA_FAILED'; iteration: number; issueCount: number; issues: string[] }
  | { type: 'QA_FIXING_STARTED'; iteration: number }
  | { type: 'QA_FIXING_COMPLETE'; iteration: number }
  | { type: 'PLANNING_FAILED'; error: string; recoverable: boolean }
  | { type: 'CODING_FAILED'; subtaskId: string; error: string; attemptCount: number }
  | { type: 'QA_MAX_ITERATIONS'; iteration: number; maxIterations: number }
  | { type: 'QA_AGENT_ERROR'; iteration: number; consecutiveErrors: number }
  | { type: 'PROCESS_EXITED'; exitCode: number; signal?: string; unexpected?: boolean }
  | { type: 'USER_STOPPED'; hasPlan?: boolean }
  | { type: 'USER_RESUMED' }
  | { type: 'MARK_DONE' }
  | { type: 'CREATE_PR' }
  | { type: 'PR_CREATED'; prUrl: string };

export const taskMachine = createMachine(
  {
    id: 'task',
    initial: 'backlog',
    types: {} as {
      context: TaskContext;
      events: TaskEvent;
    },
    context: {
      error: undefined
    },
    states: {
      backlog: {
        on: {
          PLANNING_STARTED: 'planning',
          // Fallback: if coding starts from backlog (e.g., resumed task), go to coding
          CODING_STARTED: 'coding',
          USER_STOPPED: 'backlog'
        }
      },
      planning: {
        on: {
          PLANNING_COMPLETE: [
            {
              target: 'plan_review',
              guard: 'requiresReview'
            },
            { target: 'coding' }
          ],
          // Fallback: if CODING_STARTED arrives while in planning, transition to coding
          CODING_STARTED: 'coding',
          // Fallback: if ALL_SUBTASKS_DONE arrives while in planning, go directly to qa_review
          ALL_SUBTASKS_DONE: 'qa_review',
          // Fallback: if QA_STARTED arrives while in planning, go to qa_review
          QA_STARTED: 'qa_review',
          // Fallback: if QA_PASSED arrives while in planning (entire build completed), go to preview
          QA_PASSED: 'preview',
          PLANNING_FAILED: { target: 'error', actions: 'setError' },
          USER_STOPPED: [
            { target: 'backlog', guard: 'noPlanYet' },
            { target: 'preview' }
          ],
          PROCESS_EXITED: { target: 'error', guard: 'unexpectedExit' }
        }
      },
      plan_review: {
        on: {
          PLAN_APPROVED: 'coding',
          USER_STOPPED: 'backlog',
          PROCESS_EXITED: { target: 'error', guard: 'unexpectedExit' }
        }
      },
      coding: {
        on: {
          QA_STARTED: 'qa_review',
          // ALL_SUBTASKS_DONE means coder finished but QA hasn't started yet
          // Transition to qa_review - QA will emit QA_PASSED or QA_FAILED
          ALL_SUBTASKS_DONE: 'qa_review',
          // Fallback: if QA_PASSED arrives while still in coding (missed QA_STARTED), go to preview
          QA_PASSED: 'preview',
          CODING_FAILED: { target: 'error', actions: 'setError' },
          USER_STOPPED: 'preview',
          PROCESS_EXITED: { target: 'error', guard: 'unexpectedExit' }
        }
      },
      qa_review: {
        on: {
          QA_FAILED: 'qa_fixing',
          QA_PASSED: 'preview',
          QA_MAX_ITERATIONS: 'error',
          QA_AGENT_ERROR: 'error',
          USER_STOPPED: 'preview',
          PROCESS_EXITED: { target: 'error', guard: 'unexpectedExit' }
        }
      },
      qa_fixing: {
        on: {
          QA_FIXING_COMPLETE: 'qa_review',
          QA_FAILED: 'preview',
          QA_PASSED: 'preview',
          QA_MAX_ITERATIONS: 'error',
          QA_AGENT_ERROR: 'error',
          USER_STOPPED: 'preview',
          PROCESS_EXITED: { target: 'error', guard: 'unexpectedExit' }
        }
      },
      preview: {
        on: {
          CREATE_PR: 'creating_pr',
          MARK_DONE: 'done',
          USER_RESUMED: 'coding',
          // Allow restarting planning from preview (e.g., incomplete task with no subtasks)
          PLANNING_STARTED: 'planning'
        }
      },
      error: {
        on: {
          USER_RESUMED: 'coding',
          // Allow restarting from error back to planning (e.g., spec creation crashed)
          PLANNING_STARTED: 'planning',
          MARK_DONE: 'done'
        }
      },
      creating_pr: {
        on: {
          PR_CREATED: 'pr_ready'
        }
      },
      pr_ready: {
        on: {
          MARK_DONE: 'done'
        }
      },
      done: {
        type: 'final'
      }
    }
  },
  {
    guards: {
      requiresReview: ({ event }) =>
        event.type === 'PLANNING_COMPLETE' && event.requireReviewBeforeCoding === true,
      noPlanYet: ({ event }) => event.type === 'USER_STOPPED' && event.hasPlan === false,
      unexpectedExit: ({ event }) => event.type === 'PROCESS_EXITED' && event.unexpected === true
    },
    actions: {
      setError: assign({
        error: ({ event }) => {
          if (event.type === 'PLANNING_FAILED') {
            return event.error;
          }
          if (event.type === 'CODING_FAILED') {
            return event.error;
          }
          return undefined;
        }
      })
    }
  }
);
