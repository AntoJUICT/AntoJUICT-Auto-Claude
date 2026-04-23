import { useCallback, useEffect, useRef } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { useTaskStore } from '../../stores/task-store';
import { BrainstormView } from './BrainstormView';
import { PlanReviewView } from './PlanReviewView';
import { ExecutionView } from './ExecutionView';

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
  done: 'Klaar',
};

export function PipelineView({ taskId, specDir, projectDir, taskDescription }: PipelineViewProps) {
  const phase = usePipelineStore((s) => s.phase);
  const setPhase = usePipelineStore((s) => s.setPhase);
  const setTaskContext = usePipelineStore((s) => s.setTaskContext);
  const setIsPlanWriting = usePipelineStore((s) => s.setIsPlanWriting);
  const setPlanWritingProgress = usePipelineStore((s) => s.setPlanWritingProgress);
  const addPlanWritingStep = usePipelineStore((s) => s.addPlanWritingStep);
  const planWritingSteps = usePipelineStore((s) => s.planWritingSteps);
  const setFunctionalPlan = usePipelineStore((s) => s.setFunctionalPlan);
  const loadPersistedState = usePipelineStore((s) => s.loadPersistedState);
  const isStateLoaded = usePipelineStore((s) => s.isStateLoaded);
  const logBottomRef = useRef<HTMLDivElement>(null);

  // On task change: restore persisted brainstorm history and determine pipeline phase
  useEffect(() => {
    setTaskContext(taskId, specDir, projectDir);

    async function restoreState() {
      const historyResult = await window.electronAPI.pipeline.loadBrainstormHistory(specDir);
      const savedMessages = historyResult.success && historyResult.data ? historyResult.data.messages : [];
      const savedSpecSummary = historyResult.success && historyResult.data ? historyResult.data.specSummary : null;

      // Determine phase from task status + whether functional plan exists
      const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
      const taskStatus = task?.status;

      if (taskStatus === 'planning') {
        const planResult = await window.electronAPI.pipeline.getFunctionalPlan(specDir);
        if (planResult.success && planResult.data) {
          loadPersistedState(
            savedMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
            'plan_review',
            savedSpecSummary,
            planResult.data,
          );
        } else {
          // Plan still being written — show writing phase (progress will come via onPlanProgress)
          loadPersistedState(
            savedMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
            'plan_writing',
            savedSpecSummary,
          );
        }
      } else if (taskStatus === 'executing' || taskStatus === 'verifying') {
        loadPersistedState(
          savedMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          'executing',
          savedSpecSummary,
        );
      } else {
        // brainstorming or inbox — restore messages, start from brainstorm
        loadPersistedState(
          savedMessages as Array<{ role: 'user' | 'assistant'; content: string }>,
          'brainstorm',
          savedSpecSummary,
        );
      }
    }

    restoreState().catch(console.error);
  }, [taskId, specDir, projectDir, setTaskContext, loadPersistedState]);

  // Subscribe to plan writing progress
  useEffect(() => {
    const cleanup = window.electronAPI.pipeline.onPlanProgress((event) => {
      setPlanWritingProgress(event.message);
      addPlanWritingStep(event.message);
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
  }, [specDir, setPhase, setIsPlanWriting, setPlanWritingProgress, addPlanWritingStep, setFunctionalPlan]);

  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planWritingSteps.length]);

  const handleReadyToPlan = useCallback(
    async (specSummary: string) => {
      setPhase('plan_writing');
      setIsPlanWriting(true);
      window.electronAPI.updateTaskStatus(taskId, 'planning').catch((err: unknown) => {
        console.error('[PipelineView] Failed to update task status to planning:', err);
      });
      try {
        await window.electronAPI.pipeline.writePlan(specSummary, specDir, projectDir);
      } catch (err) {
        console.error('Plan writing failed:', err);
        setIsPlanWriting(false);
        setPhase('brainstorm');
      }
    },
    [taskId, specDir, projectDir, setPhase, setIsPlanWriting],
  );

  const handleApprove = useCallback(() => {
    useTaskStore.getState().updateTask(taskId, { reviewState: 'plan_approved' });
    setPhase('executing');
  }, [taskId, setPhase]);

  const handleRevise = useCallback(() => {
    setPhase('brainstorm');
    setFunctionalPlan(null);
  }, [setPhase, setFunctionalPlan]);

  const handleExecutionComplete = useCallback(() => {
    window.electronAPI.updateTaskStatus(taskId, 'verifying').catch((err: unknown) => {
      console.error('[PipelineView] Failed to update task status to verifying:', err);
    });
    setPhase('done');
  }, [taskId, setPhase]);

  const phases = ['brainstorm', 'plan_writing', 'plan_review', 'executing', 'done'] as const;
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
        {!isStateLoaded && (
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {isStateLoaded && phase === 'brainstorm' && (
          <BrainstormView onReadyToPlan={handleReadyToPlan} taskDescription={taskDescription} taskId={taskId} />
        )}
        {isStateLoaded && phase === 'plan_writing' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Plan wordt opgesteld...</span>
              <span className="text-xs text-muted-foreground ml-auto">automatisch</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 font-mono text-xs">
              {planWritingSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-primary/50 shrink-0 mt-px">›</span>
                  <span>{step}</span>
                </div>
              ))}
              {planWritingSteps.length === 0 && (
                <p className="text-muted-foreground">Codebase wordt geanalyseerd...</p>
              )}
              <div ref={logBottomRef} />
            </div>
          </div>
        )}
        {isStateLoaded && phase === 'plan_review' && (
          <PlanReviewView onApprove={handleApprove} onRevise={handleRevise} />
        )}
        {isStateLoaded && phase === 'executing' && (
          <ExecutionView taskId={taskId} onComplete={handleExecutionComplete} />
        )}
        {isStateLoaded && phase === 'done' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Taak afgerond ✅</p>
          </div>
        )}
      </div>
    </div>
  );
}
