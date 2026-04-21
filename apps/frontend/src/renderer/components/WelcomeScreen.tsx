import { FolderOpen, FolderPlus, Clock, ChevronRight, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from './ui/scroll-area';
import { MeshMark } from './ui/MeshMark';
import type { Project } from '../../shared/types';

interface WelcomeScreenProps {
  projects: Project[];
  onNewProject: () => void;
  onOpenProject: () => void;
  onSelectProject: (projectId: string) => void;
}

export function WelcomeScreen({
  projects,
  onNewProject,
  onOpenProject,
  onSelectProject
}: WelcomeScreenProps) {
  const { t } = useTranslation(['welcome', 'common']);

  // Sort projects by updatedAt (most recent first)
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('common:time.justNow');
    if (diffMins < 60) return t('common:time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('common:time.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('common:time.daysAgo', { count: diffDays });
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[var(--background)] p-8">
      {/* Hero centered block */}
      <div className="flex flex-col items-center text-center max-w-lg">

        {/* Brand tile with glow */}
        <div className="relative mb-8">
          {/* Radial glow halo */}
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{ background: 'radial-gradient(circle, #ff3862 0%, transparent 70%)', transform: 'scale(1.8)' }}
          />
          {/* Gradient tile */}
          <div
            className="relative flex h-[72px] w-[72px] items-center justify-center rounded-[14px]"
            style={{ background: 'var(--brand-gradient)' }}
          >
            <MeshMark size={42} stroke="white" accent="white" animate />
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-[42px] font-bold leading-tight text-[var(--foreground)]"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
        >
          {t('welcome:hero.title')}
        </h1>
        <p className="mt-3 text-[15px] text-[var(--text-dim)] max-w-sm">
          {t('welcome:hero.subtitle')}
        </p>

        {/* Action buttons */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={onOpenProject}
            className="flex items-center gap-2 rounded-[5px] px-5 py-2.5 text-[14px] font-medium text-white shadow-[var(--shadow-cta)] transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand-gradient)' }}
          >
            <FolderOpen className="h-4 w-4" />
            {t('welcome:actions.openProject')}
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-[14px] text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-hi)] hover:text-[var(--foreground)]"
          >
            <FolderPlus className="h-4 w-4" />
            {t('welcome:actions.newProject')}
          </button>
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-6 flex items-center gap-4 font-mono text-[10px] text-[var(--text-mute)]">
          <span><kbd className="rounded border border-[var(--border)] px-1">Ctrl O</kbd> open workspace</span>
          <span><kbd className="rounded border border-[var(--border)] px-1">Ctrl N</kbd> new task</span>
        </div>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <div className="flex items-center gap-2 mb-3 text-[11px] text-[var(--text-mute)] uppercase tracking-wide font-mono">
            <Clock className="h-3.5 w-3.5" />
            {t('welcome:recentProjects.title')}
          </div>
          <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <ScrollArea className="max-h-[280px]">
              <div className="divide-y divide-[var(--border)]">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-hi)] group"
                    aria-label={t('welcome:recentProjects.openProjectAriaLabel', { name: project.name })}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--surface-hi)] shrink-0">
                      <Folder className="h-4 w-4 text-[var(--text-dim)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[var(--foreground)] truncate">
                          {project.name}
                        </span>
                        {project.autoBuildPath && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-[3px] bg-[var(--success)]/15 text-[var(--success)] shrink-0 font-mono">
                            INIT
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-[var(--text-mute)] truncate mt-0.5">
                        {project.path}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-[var(--text-mute)]">
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-mute)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="mt-10 w-full max-w-lg rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <Folder className="h-8 w-8 text-[var(--text-mute)] mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[var(--foreground)] mb-1">{t('welcome:recentProjects.empty')}</p>
          <p className="text-[12px] text-[var(--text-dim)]">{t('welcome:recentProjects.emptyDescription')}</p>
        </div>
      )}
    </div>
  );
}
