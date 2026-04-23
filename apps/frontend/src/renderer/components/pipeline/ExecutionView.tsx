import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '@/stores/pipeline-store';
import { cn } from '@/lib/utils';
import type { ImplementationPlan } from '@shared/types';

interface ExecutionViewProps {
  taskId: string;
  onComplete: () => void;
}

/**
 * ExecutionView: Real-time task execution display with live subtask list
 * Subscribes to IPC task progress events and updates Zustand store
 */
export function ExecutionView({ taskId, onComplete }: ExecutionViewProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const subtasks = usePipelineStore((s) => s.subtasks);
  const setSubtasks = usePipelineStore((s) => s.setSubtasks);

  const completed = subtasks.filter((t) => t.status === 'completed').length;
  const total = subtasks.length;
  const allDone = total > 0 && completed === total;

  // Auto-advance to finish phase when all tasks complete
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [allDone, onComplete]);

  // Subscribe to task progress updates via IPC
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const listener = window.electronAPI?.onTaskProgress?.(
          (receivedTaskId: string, plan: ImplementationPlan) => {
            if (receivedTaskId !== taskId) return;

            // Extract subtasks from all phases
            const allSubtasks = plan.phases?.flatMap((phase: any) =>
              phase.subtasks?.map((subtask: any) => ({
                id: subtask.id || subtask.description || `task-${Math.random()}`,
                description: subtask.description,
                status: mapSubtaskStatus(subtask.status),
              })) ?? []
            ) ?? [];

            setSubtasks(allSubtasks);
          }
        );

        unsubscribe = listener;
      } catch (error) {
        console.warn('[ExecutionView] Failed to setup task progress listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [taskId, setSubtasks]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'blocked':
        return '🚫';
      default:
        return '☐';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">{t('tasks:execution.title')}</h2>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('tasks:execution.progress', { completed, total })}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtasks List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {subtasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Klaar om te starten</p>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Klik op <span className="font-semibold">Start Task</span> rechtsonder om de uitvoering te beginnen.
            </p>
          </div>
        ) : (
          subtasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'flex items-start gap-2 py-1.5 px-2 rounded text-sm transition-colors duration-200',
                task.status === 'in_progress' && 'bg-primary/5',
                task.status === 'completed' && 'opacity-60',
                task.status === 'blocked' && 'bg-red-500/5'
              )}
            >
              <span className="mt-0.5 shrink-0 text-base">{statusIcon(task.status)}</span>
              <span
                className={cn(
                  task.status === 'completed' && 'line-through text-muted-foreground',
                  task.status === 'in_progress' && 'font-medium text-foreground',
                  task.status === 'blocked' && 'text-red-600'
                )}
              >
                {task.description}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Completion Message */}
      {allDone && (
        <div className="px-4 py-3 border-t border-border bg-green-500/5">
          <p className="text-sm text-green-600 font-medium text-center">
            {t('tasks:execution.complete')}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Map subtask status from ImplementationPlan to pipeline UI format
 */
function mapSubtaskStatus(
  status: string | undefined
): 'pending' | 'in_progress' | 'completed' | 'blocked' {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return 'completed';
    case 'in_progress':
    case 'running':
    case 'active':
      return 'in_progress';
    case 'blocked':
    case 'failed':
    case 'error':
      return 'blocked';
    default:
      return 'pending';
  }
}
