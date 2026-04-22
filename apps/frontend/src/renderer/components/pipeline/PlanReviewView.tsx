import { useEffect } from 'react';
import type { IPCResult } from '@shared/types';
import { usePipelineStore } from '../../stores/pipeline-store';

interface PlanReviewViewProps {
  onApprove: () => void;
  onRevise: () => void;
}

export function PlanReviewView({ onApprove, onRevise }: PlanReviewViewProps) {
  const functionalPlan = usePipelineStore((s) => s.functionalPlan);
  const specDir = usePipelineStore((s) => s.specDir);
  const isPlanWriting = usePipelineStore((s) => s.isPlanWriting);
  const planWritingProgress = usePipelineStore((s) => s.planWritingProgress);
  const setFunctionalPlan = usePipelineStore((s) => s.setFunctionalPlan);

  useEffect(() => {
    if (!functionalPlan && specDir && !isPlanWriting) {
      window.electronAPI.pipeline.getFunctionalPlan(specDir).then((result: IPCResult<string>) => {
        if (result.success && result.data) setFunctionalPlan(result.data);
      });
    }
  }, [functionalPlan, specDir, isPlanWriting, setFunctionalPlan]);

  if (isPlanWriting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">
          {planWritingProgress || 'Plan wordt opgesteld...'}
        </p>
      </div>
    );
  }

  if (!functionalPlan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Plan laden...</p>
      </div>
    );
  }

  const lines = functionalPlan
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Plan review</h2>
        <p className="text-xs text-muted-foreground">
          Bekijk wat er gebouwd wordt en keur goed of pas aan
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-1 text-sm">
          {lines.map((line, i) => {
            if (line.startsWith('## ')) {
              return (
                <h3 key={i} className="font-semibold mt-4 mb-2 text-foreground">
                  {line.replace('## ', '')}
                </h3>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span className="text-foreground">{line.replace('- ', '')}</span>
                </div>
              );
            }
            return (
              <p key={i} className="text-muted-foreground">
                {line}
              </p>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border flex gap-3">
        <button
          onClick={onApprove}
          className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Goedkeuren →
        </button>
        <button
          onClick={onRevise}
          className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors"
        >
          Aanpassen
        </button>
      </div>
    </div>
  );
}
