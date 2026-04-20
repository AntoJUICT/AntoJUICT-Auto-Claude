import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface PreviewStatus {
  status: string;
  port: number | null;
  url: string | null;
  lastError: string | null;
}

interface PreviewBadgeProps {
  taskId: string;
  className?: string;
}

const POLL_INTERVAL_ACTIVE_MS = 3000;
const POLL_INTERVAL_IDLE_MS = 15000;

export function PreviewBadge({ taskId, className }: PreviewBadgeProps) {
  const { t } = useTranslation('kanban');
  const [status, setStatus] = useState<PreviewStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.preview.status(taskId);
      setStatus(result);
    } catch {
      setStatus(null);
    }
  }, [taskId]);

  useEffect(() => {
    fetchStatus();

    const isActive = status?.status === 'starting' || status?.status === 'running';
    const interval = setInterval(fetchStatus, isActive ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS);
    return () => clearInterval(interval);
  }, [fetchStatus, status?.status]);

  if (!status || status.status === 'stopped' || status.status === 'idle') {
    return null;
  }

  if (status.status === 'starting') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-blue-500/10 text-blue-500 border-blue-500/30',
          className
        )}
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        {t('preview.badge.starting')}
      </Badge>
    );
  }

  if (status.status === 'running') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
          className
        )}
        title={status.port ? t('preview.status.port', { port: status.port }) : undefined}
      >
        <Monitor className="h-2.5 w-2.5" />
        {t('preview.badge.running')}
      </Badge>
    );
  }

  if (status.status === 'error') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] px-1.5 py-0.5 flex items-center gap-1 bg-red-500/10 text-red-500 border-red-500/30',
          className
        )}
        title={status.lastError ?? undefined}
      >
        <Monitor className="h-2.5 w-2.5" />
        {t('preview.badge.error')}
      </Badge>
    );
  }

  return null;
}
