import { useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';

interface FinishingViewProps {
  onDone: () => void;
}

export function FinishingView({ onDone }: FinishingViewProps) {
  const specDir = usePipelineStore((s) => s.specDir);
  const projectDir = usePipelineStore((s) => s.projectDir);
  const finishProgress = usePipelineStore((s) => s.finishProgress);
  const isFinishing = usePipelineStore((s) => s.isFinishing);
  const addFinishProgress = usePipelineStore((s) => s.addFinishProgress);
  const setIsFinishing = usePipelineStore((s) => s.setIsFinishing);
  const setPhase = usePipelineStore((s) => s.setPhase);

  const lastEvent = finishProgress[finishProgress.length - 1];
  const isDone = lastEvent?.status === 'complete';

  useEffect(() => {
    const cleanup = window.electronAPI.pipeline.onFinishProgress((event) => {
      addFinishProgress({ status: event.status, message: event.message });
      if (event.status === 'complete') {
        setIsFinishing(false);
      }
    });
    return cleanup;
  }, [addFinishProgress, setIsFinishing]);

  const handleAction = async (action: 'test' | 'pr' | 'merge') => {
    if (!specDir || !projectDir || isFinishing) return;
    setIsFinishing(true);
    try {
      await window.electronAPI.pipeline.finish(action, specDir, projectDir);
    } catch (err) {
      addFinishProgress({ status: 'error', message: String(err) });
      setIsFinishing(false);
    }
  };

  const handleDone = () => {
    setPhase('done');
    onDone();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Afronden</h2>
        <p className="text-xs text-muted-foreground">Kies hoe je verder gaat</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {!isFinishing && !isDone && (
          <div className="grid gap-2">
            <button
              onClick={() => handleAction('test')}
              className="w-full px-4 py-3 rounded-lg border border-border text-sm text-left hover:bg-muted transition-colors"
            >
              <div className="font-medium">🧪 Tests draaien</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Controleer of alles nog werkt
              </div>
            </button>
            <button
              onClick={() => handleAction('pr')}
              className="w-full px-4 py-3 rounded-lg border border-border text-sm text-left hover:bg-muted transition-colors"
            >
              <div className="font-medium">🔀 Pull Request aanmaken</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Branch pushen en PR openen op GitHub
              </div>
            </button>
            <button
              onClick={() => handleAction('merge')}
              className="w-full px-4 py-3 rounded-lg border border-border text-sm text-left hover:bg-muted transition-colors"
            >
              <div className="font-medium">✅ Direct mergen naar main</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Wijzigingen direct in main branch
              </div>
            </button>
          </div>
        )}

        {finishProgress.length > 0 && (
          <div className="rounded-lg border border-border p-3 space-y-1">
            {finishProgress.map((event, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={
                    event.status === 'complete'
                      ? 'text-green-500'
                      : event.status === 'error'
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                  }
                >
                  {event.status === 'complete' ? '✓' : event.status === 'error' ? '✗' : '·'}
                </span>
                <span className="text-foreground">{event.message}</span>
              </div>
            ))}
          </div>
        )}

        {isFinishing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Bezig...
          </div>
        )}

        {isDone && (
          <button
            onClick={handleDone}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Klaar ✓
          </button>
        )}
      </div>
    </div>
  );
}
