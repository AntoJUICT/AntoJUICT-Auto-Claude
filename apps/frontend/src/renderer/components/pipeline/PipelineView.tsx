import { useCallback, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { BrainstormView } from './BrainstormView';
import { PlanReviewView } from './PlanReviewView';
import { ExecutionView } from './ExecutionView';
import { FinishingView } from './FinishingView';

interface PipelineViewProps {
  taskId: string;
  specDir: string;
  projectDir: string;
  taskDescription?: string;
}

const PHASE_LABELS = {
  brainstorm: 'Brainstorm',
  plan_writing: 'Plan schrijven',
  plan_review: 'Plan review',
  executing: 'Uitvoeren',
  finishing: 'Afronden',
  done: 'Klaar',
};

export function PipelineView({ taskId, specDir, projectDir, taskDescription }: PipelineViewProps) {
  const phase = usePipelineStore((s) => s.phase);
  const setPhase = usePipelineStore((s) => s.setPhase);
  const setTaskContext = usePipelineStore((s) => s.setTaskContext);
  const setIsPlanWriting = usePipelineStore((s) => s.setIsPlanWriting);
  const setPlanWritingProgress = usePipelineStore((s) => s.setPlanWritingProgress);
  const setFunctionalPlan = usePipelineStore((s) => s.setFunctionalPlan);

  useEffect(() => {
    setTaskContext(taskId, specDir, projectDir);
  }, [taskId, specDir, projectDir, setTaskContext]);

  // Subscribe to plan writing progress
  useEffect(() => {
    const cleanup = window.electronAPI.pipeline.onPlanProgress((event) => {
      setPlanWritingProgress(event.message);
      if (event.status === 'complete') {
        setIsPlanWriting(false);
        setPhase('plan_review');
        window.electronAPI.pipeline.getFunctionalPlan(specDir).then((result) => {
          const plan = (result as any)?.data ?? result;
          if (typeof plan === 'string') setFunctionalPlan(plan);
        });
      }
    });
    return cleanup;
  }, [specDir, setPhase, setIsPlanWriting, setPlanWritingProgress, setFunctionalPlan]);

  const handleReadyToPlan = useCallback(
    async (specSummary: string) => {
      setPhase('plan_writing');
      setIsPlanWriting(true);
      try {
        await window.electronAPI.pipeline.writePlan(specSummary, specDir, projectDir);
      } catch (err) {
        console.error('Plan writing failed:', err);
        setIsPlanWriting(false);
        setPhase('brainstorm');
      }
    },
    [specDir, projectDir, setPhase, setIsPlanWriting],
  );

  const handleApprove = useCallback(() => {
    setPhase('executing');
  }, [setPhase]);

  const handleRevise = useCallback(() => {
    setPhase('brainstorm');
    setFunctionalPlan(null);
  }, [setPhase, setFunctionalPlan]);

  const handleExecutionComplete = useCallback(() => {
    setPhase('finishing');
  }, [setPhase]);

  const handleFinishingDone = useCallback(() => {
    setPhase('done');
  }, [setPhase]);

  const phases = ['brainstorm', 'plan_writing', 'plan_review', 'executing', 'finishing', 'done'] as const;
  const currentIndex = phases.indexOf(phase as typeof phases[number]);

  return (
    <div className="flex flex-col h-full">
      {/* Phase stepper */}
      <div className="flex items-center gap-0 px-4 py-2 border-b border-border bg-muted/30 overflow-x-auto">
        {phases.slice(0, -1).map((p, i) => (
          <div key={p} className="flex items-center">
            <div
              className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${
                i === currentIndex
                  ? 'text-primary font-medium'
                  : i < currentIndex
                    ? 'text-muted-foreground line-through'
                    : 'text-muted-foreground'
              }`}
            >
              {PHASE_LABELS[p]}
            </div>
            {i < phases.length - 2 && (
              <span className="text-muted-foreground/40 mx-0.5 text-xs">›</span>
            )}
          </div>
        ))}
      </div>

      {/* Phase content */}
      <div className="flex-1 overflow-hidden">
        {(phase === 'brainstorm' || phase === 'plan_writing') && (
          <BrainstormView onReadyToPlan={handleReadyToPlan} taskDescription={taskDescription} taskId={taskId} />
        )}
        {phase === 'plan_review' && (
          <PlanReviewView onApprove={handleApprove} onRevise={handleRevise} />
        )}
        {phase === 'executing' && (
          <ExecutionView taskId={taskId} onComplete={handleExecutionComplete} />
        )}
        {phase === 'finishing' && <FinishingView onDone={handleFinishingDone} />}
        {phase === 'done' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Taak afgerond ✅</p>
          </div>
        )}
      </div>
    </div>
  );
}
