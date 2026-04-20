import { useTranslation } from 'react-i18next';
import type { SubtaskAgentPhase } from '@shared/types/task';

interface SubtaskProgressProps {
  currentIndex: number;
  total: number;
  agentPhase: SubtaskAgentPhase;
}

export function SubtaskProgress({ currentIndex, total, agentPhase }: SubtaskProgressProps) {
  const { t } = useTranslation('kanban');
  const percentage = total > 0 ? Math.floor((currentIndex / total) * 100) : 0;
  const phaseLabel = t(`subtaskPhase.${agentPhase}`);

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-muted-foreground">
        {t('subtaskProgress.label', { current: currentIndex + 1, total, phase: phaseLabel })}
      </p>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
