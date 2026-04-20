import { useTranslation } from 'react-i18next';
import type { TaskStatus } from '@shared/types/task';

const APPROVAL_STATUSES = ['spec_review', 'plan_review', 'preview'] as const;
type ApprovalStatus = typeof APPROVAL_STATUSES[number];

function isApprovalStatus(status: TaskStatus): status is ApprovalStatus {
  return (APPROVAL_STATUSES as readonly string[]).includes(status);
}

interface ApprovalActionsProps {
  status: TaskStatus;
  onApprove: () => void;
  onSendBack: () => void;
}

export function ApprovalActions({ status, onApprove, onSendBack }: ApprovalActionsProps) {
  const { t } = useTranslation('kanban');
  if (!isApprovalStatus(status)) return null;

  return (
    <div className="mt-2 flex gap-1.5">
      <button
        type="button"
        onClick={onApprove}
        className="flex-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t(`approval.${status}.approve`)}
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
