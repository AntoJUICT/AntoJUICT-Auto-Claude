import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { Settings2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import type { Project } from '../../shared/types';

interface SortableProjectTabProps {
  project: Project;
  isActive: boolean;
  canClose: boolean;
  tabIndex: number;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  // Optional control props for active tab
  onSettingsClick?: () => void;
}

// Detect if running on macOS for keyboard shortcut display
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';

export function SortableProjectTab({
  project,
  isActive,
  canClose,
  tabIndex,
  onSelect,
  onClose,
  onSettingsClick
}: SortableProjectTabProps) {
  const { t } = useTranslation('common');
  // Build tooltip with keyboard shortcut hint (only for tabs 1-9)
  const shortcutHint = tabIndex < 9 ? `${modKey}${tabIndex + 1}` : '';
  const closeShortcut = `${modKey}W`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Prevent z-index stacking issues during drag
    zIndex: isDragging ? 50 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center h-9 min-w-0',
        isActive
          ? 'max-w-[200px] sm:max-w-[240px]'
          : 'max-w-[140px] sm:max-w-[180px]',
        'border-r border-[var(--border)] last:border-r-0',
        'touch-none',
        isDragging && 'opacity-60 scale-[0.98] shadow-lg',
        isActive
          ? 'bg-[var(--background)] border-t-2 border-t-[var(--primary)]'
          : 'bg-transparent border-t-2 border-t-transparent hover:bg-[var(--surface)]'
      )}
      {...attributes}
    >
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className="flex-1 flex items-center gap-2 px-3 py-1.5 min-w-0 cursor-pointer"
            onClick={onSelect}
          >
            {/* Drag handle */}
            <div
              {...listeners}
              className="hidden sm:block opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing w-1 h-3 bg-[var(--text-mute)] rounded-full shrink-0"
            />
            {/* Status dot */}
            <span className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0',
              isActive ? 'bg-[var(--success)]' : 'bg-[var(--text-mute)]'
            )} />
            {/* Name */}
            <span className={cn(
              'truncate text-[12px]',
              isActive
                ? 'font-semibold text-[var(--foreground)]'
                : 'font-normal text-[var(--text-dim)]'
            )}>
              {project.name}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          <span>{project.name}</span>
          {shortcutHint && (
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">
              {shortcutHint}
            </kbd>
          )}
        </TooltipContent>
      </Tooltip>

      {/* Settings icon for active tab */}
      {isActive && onSettingsClick && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="h-5 w-5 flex items-center justify-center rounded text-[var(--text-mute)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors focus-visible:outline-none"
              onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
              aria-label={t('projectTab.settings')}
            >
              <Settings2 className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('projectTab.settings')}</TooltipContent>
        </Tooltip>
      )}

      {/* Close button */}
      {canClose && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'h-5 w-5 mr-1 flex items-center justify-center rounded shrink-0',
                'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity',
                'text-[var(--text-mute)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]',
                isActive && 'opacity-60'
              )}
              onClick={onClose}
              aria-label={t('projectTab.closeTabAriaLabel')}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <span>{t('projectTab.closeTab')}</span>
            <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded border border-border font-mono">
              {closeShortcut}
            </kbd>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
