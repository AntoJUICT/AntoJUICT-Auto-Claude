import { useTranslation } from 'react-i18next';
import { SKILL_CHECKLISTS } from '@shared/constants/skills';
import type { TaskSkillProgress } from '@shared/types/task';

interface Props {
  skillProgress: TaskSkillProgress;
}

export function SkillChecklist({ skillProgress }: Props) {
  const { t } = useTranslation('kanban');
  const { skill, currentStepIndex } = skillProgress;
  if (!skill) return null;
  const steps = SKILL_CHECKLISTS[skill] ?? [];

  return (
    <div className="flex flex-col gap-1 bg-black/20 rounded-md p-2 mt-1">
      {steps.map((step, index) => {
        const isDone = index < currentStepIndex;
        const isActive = index === currentStepIndex;
        return (
          <div
            key={step.id}
            className={`flex items-center gap-2 text-xs ${
              isDone
                ? 'text-muted-foreground line-through'
                : isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground/50'
            }`}
          >
            <span className="shrink-0 w-3 text-center">
              {isDone ? '✓' : isActive ? '▶' : '○'}
            </span>
            <span>{t(step.label.replace('kanban:', ''))}</span>
          </div>
        );
      })}
    </div>
  );
}
