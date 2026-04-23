import { useTranslation } from 'react-i18next';
import { SKILL_COLUMN_META } from '@shared/constants/skills';
import type { TaskSkillProgress, TaskReviewState } from '@shared/types/task';

interface Props {
  skillProgress?: TaskSkillProgress;
  reviewState: TaskReviewState;
}

export function SkillBadge({ skillProgress, reviewState }: Props) {
  const { t } = useTranslation('kanban');

  if (reviewState === 'plan_approved') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-600/60 bg-green-900/30 px-2 py-1">
        <span className="text-sm">✅</span>
        <span className="text-xs font-bold text-green-400">
          {t('review.plan_approved')}
        </span>
      </div>
    );
  }

  if (reviewState !== 'none') {
    const reviewMessage = t(`review.${reviewState}`);
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-600/60 bg-amber-900/30 px-2 py-1">
        <span className="text-sm">👀</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-amber-400">
            {t('review.awaitingReview')}
          </span>
          <span className="text-[10px] text-amber-700">{reviewMessage}</span>
        </div>
      </div>
    );
  }

  if (!skillProgress?.skill) return null;

  const meta = SKILL_COLUMN_META.find(m => m.skill === skillProgress.skill);
  const skillLabel = t(`skills.${skillProgress.skill}`);

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: `${meta?.color}22`, color: meta?.color }}
      >
        {skillLabel}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {skillProgress.currentStepIndex + 1} / {skillProgress.totalSteps}
      </span>
    </div>
  );
}
