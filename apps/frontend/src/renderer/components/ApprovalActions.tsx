import { useTranslation } from 'react-i18next';
import type { TaskReviewState } from '@shared/types/task';

const APPROVAL_REVIEW_STATES = ['spec_review', 'plan_review', 'approval'] as const;
type ApprovalStatus = typeof APPROVAL_REVIEW_STATES[number];

function isApprovalReviewState(reviewState: TaskReviewState): reviewState is ApprovalStatus {
  return (APPROVAL_REVIEW_STATES as readonly string[]).includes(reviewState);
}

interface ApprovalActionsProps {
  reviewState: TaskReviewState;
  onApprove: () => void;
  onSendBack: () => void;
}

export function ApprovalActions({ reviewState, onApprove, onSendBack }: ApprovalActionsProps) {
  const { t } = useTranslation('kanban');
  if (!isApprovalReviewState(reviewState)) return null;

  return (
    <div className="mt-2 flex gap-1.5">
      <button
        type="button"
        onClick={onApprove}
        className="flex-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t(`approval.${reviewState}.approve`)}
      </button>
      <button
        type="button"
        onClick={onSendBack}
        className="flex-1 rounded px-2 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        {t('approval.sendBack')}
      </button>
    </div>
  );
}
