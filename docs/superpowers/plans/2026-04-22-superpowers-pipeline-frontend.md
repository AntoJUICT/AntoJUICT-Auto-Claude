# Superpowers Pipeline Redesign — Plan B: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Plan A (backend) must be complete before starting this plan.

**Goal:** Vervang de bestaande spec/QA pipeline views door vier nieuwe views die het superpowers-process visualiseren: BrainstormView (chat), PlanReviewView (goedkeuring), ExecutionView (live tasklist), FinishingView (afronden).

**Architecture:** Vier nieuwe React componenten in `apps/frontend/src/renderer/components/pipeline/`. Elk component heeft een bijbehorende Zustand store slice. De routing in App.tsx stuurt op basis van de nieuwe `PipelinePhase` type. Alle oude spec/QA views worden verwijderd.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Tailwind CSS v4, react-i18next, Electron IPC via `window.electronAPI.pipeline`

---

### Task 1: Verwijder oude frontend pipeline views

**Files:**
- Delete: alle bestanden die de oude spec/QA pipeline weergeven
- Modify: routing/App.tsx om verwijderde views te ontkoppelen

- [ ] **Stap 1: Zoek bestanden gerelateerd aan de oude spec/QA pipeline**

```bash
cd apps/frontend/src
grep -r "spec_review\|plan_review\|brainstorming\|TaskChatPhase\|SpecPhase\|QAPhase\|QaPhase" --include="*.tsx" --include="*.ts" -l
```

Noteer alle gevonden bestanden.

- [ ] **Stap 2: Zoek ook Kanban fase-logica**

```bash
grep -r "PLANNING\|CODING\|spec_gathering\|spec_writing\|complexity" --include="*.tsx" --include="*.ts" -l renderer/
```

- [ ] **Stap 3: Verwijder TaskChatPhase component (indien bestaat)**

```bash
find renderer/ -name "TaskChatPhase*" -o -name "*SpecPhase*" -o -name "*QaPhase*" | xargs rm -f
```

- [ ] **Stap 4: Verwijder spec/qa pipeline fase-weergave uit taakkaarten**

Open de gevonden bestanden uit stap 1 en verwijder de fase-specifieke rendering logica voor `spec_review`, `plan_review`, `brainstorming` (oud), `qa_review`, `qa_fixing`. Vervang met een tijdelijke placeholder `<PipelinePhasePlaceholder />` zodat de app nog bouwt.

```tsx
// Tijdelijke placeholder
function PipelinePhasePlaceholder() {
  return <div className="p-4 text-muted-foreground">Pipeline view — wordt vervangen</div>;
}
```

- [ ] **Stap 5: Typecheck na verwijdering**

```bash
npm run typecheck 2>&1 | head -40
```

Los alle type-errors op die door de verwijderingen ontstaan.

- [ ] **Stap 6: Commit**

```bash
git add -A
git commit -m "chore(frontend): remove old spec/qa pipeline views"
```

---

### Task 2: Maak pipeline store

**Files:**
- Create: `apps/frontend/src/renderer/stores/pipeline-store.ts`

- [ ] **Stap 1: Lees een bestaande store als referentie**

```bash
head -80 apps/frontend/src/renderer/stores/insights-store.ts
```

- [ ] **Stap 2: Schrijf pipeline-store.ts**

Maak `apps/frontend/src/renderer/stores/pipeline-store.ts`:

```typescript
import { create } from 'zustand';

export type PipelinePhase =
  | 'brainstorm'
  | 'plan_writing'
  | 'plan_review'
  | 'executing'
  | 'finishing'
  | 'done';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PipelineState {
  phase: PipelinePhase;
  taskId: string | null;
  specDir: string | null;
  projectDir: string | null;

  // Brainstorm
  messages: ChatMessage[];
  specSummary: string | null;
  isBrainstormLoading: boolean;

  // Plan writing
  planWritingProgress: string;
  isPlanWriting: boolean;

  // Plan review
  functionalPlan: string | null;

  // Executing
  subtasks: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked' }>;

  // Finishing
  finishProgress: Array<{ status: string; message: string }>;
  isFinishing: boolean;

  // Actions
  setPhase: (phase: PipelinePhase) => void;
  setTaskContext: (taskId: string, specDir: string, projectDir: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setSpecSummary: (summary: string) => void;
  setBrainstormLoading: (v: boolean) => void;
  setPlanWritingProgress: (msg: string) => void;
  setIsPlanWriting: (v: boolean) => void;
  setFunctionalPlan: (plan: string) => void;
  setSubtasks: (tasks: PipelineState['subtasks']) => void;
  updateSubtaskStatus: (id: string, status: PipelineState['subtasks'][number]['status']) => void;
  addFinishProgress: (event: { status: string; message: string }) => void;
  setIsFinishing: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  phase: 'brainstorm' as PipelinePhase,
  taskId: null,
  specDir: null,
  projectDir: null,
  messages: [],
  specSummary: null,
  isBrainstormLoading: false,
  planWritingProgress: '',
  isPlanWriting: false,
  functionalPlan: null,
  subtasks: [],
  finishProgress: [],
  isFinishing: false,
};

export const usePipelineStore = create<PipelineState>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setTaskContext: (taskId, specDir, projectDir) => set({ taskId, specDir, projectDir }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSpecSummary: (specSummary) => set({ specSummary }),
  setBrainstormLoading: (isBrainstormLoading) => set({ isBrainstormLoading }),
  setPlanWritingProgress: (planWritingProgress) => set({ planWritingProgress }),
  setIsPlanWriting: (isPlanWriting) => set({ isPlanWriting }),
  setFunctionalPlan: (functionalPlan) => set({ functionalPlan }),
  setSubtasks: (subtasks) => set({ subtasks }),
  updateSubtaskStatus: (id, status) =>
    set((s) => ({
      subtasks: s.subtasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
  addFinishProgress: (event) =>
    set((s) => ({ finishProgress: [...s.finishProgress, event] })),
  setIsFinishing: (isFinishing) => set({ isFinishing }),
  reset: () => set(initialState),
}));
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "pipeline-store" | head -10
```

Verwacht: 0 errors.

- [ ] **Stap 4: Commit**

```bash
git add apps/frontend/src/renderer/stores/pipeline-store.ts
git commit -m "feat(pipeline): add pipeline Zustand store"
```

---

### Task 3: BrainstormView — chat interface

**Files:**
- Create: `apps/frontend/src/renderer/components/pipeline/BrainstormView.tsx`

- [ ] **Stap 1: Lees Insights.tsx voor het chat UI patroon**

```bash
cat apps/frontend/src/renderer/components/Insights.tsx | head -120
```

Let op: scroll-gedrag, input-handling, message rendering.

- [ ] **Stap 2: Schrijf BrainstormView.tsx**

Maak `apps/frontend/src/renderer/components/pipeline/BrainstormView.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePipelineStore } from '../../stores/pipeline-store';
import { cn } from '../../lib/utils';

interface BrainstormViewProps {
  onReadyToPlan: (specSummary: string) => void;
}

export function BrainstormView({ onReadyToPlan }: BrainstormViewProps) {
  const { t } = useTranslation('tasks');
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = usePipelineStore((s) => s.messages);
  const isBrainstormLoading = usePipelineStore((s) => s.isBrainstormLoading);
  const projectDir = usePipelineStore((s) => s.projectDir);
  const addMessage = usePipelineStore((s) => s.addMessage);
  const setBrainstormLoading = usePipelineStore((s) => s.setBrainstormLoading);
  const setSpecSummary = usePipelineStore((s) => s.setSpecSummary);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send opening message from Claude when chat is empty
  useEffect(() => {
    if (messages.length === 0 && projectDir) {
      addMessage({
        role: 'assistant',
        content: 'Wat wil je bouwen? Beschrijf het zo concreet mogelijk.',
      });
    }
  }, [messages.length, projectDir, addMessage]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isBrainstormLoading || !projectDir) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    addMessage({ role: 'user', content: text });
    setInput('');
    setBrainstormLoading(true);

    try {
      const result = await window.electronAPI.pipeline.sendBrainstormMessage(
        newMessages,
        projectDir,
      );

      addMessage({ role: 'assistant', content: result.response });

      if (result.ready_to_plan && result.spec_summary) {
        setSpecSummary(result.spec_summary);
        onReadyToPlan(result.spec_summary);
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        content: `Er ging iets mis: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBrainstormLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Brainstorm</h2>
        <p className="text-xs text-muted-foreground">Beschrijf wat je wil bouwen</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isBrainstormLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground animate-pulse">
              Claude denkt na...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-[120px]"
            placeholder="Typ je antwoord... (Enter om te versturen)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isBrainstormLoading}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isBrainstormLoading || !input.trim()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            Sturen
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Shift+Enter voor nieuwe regel
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "BrainstormView" | head -10
```

- [ ] **Stap 4: Commit**

```bash
git add apps/frontend/src/renderer/components/pipeline/BrainstormView.tsx
git commit -m "feat(pipeline): add BrainstormView chat component"
```

---

### Task 4: PlanReviewView — functioneel plan goedkeuren

**Files:**
- Create: `apps/frontend/src/renderer/components/pipeline/PlanReviewView.tsx`

- [ ] **Stap 1: Schrijf PlanReviewView.tsx**

Maak `apps/frontend/src/renderer/components/pipeline/PlanReviewView.tsx`:

```tsx
import { useEffect } from 'react';
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
      window.electronAPI.pipeline.getFunctionalPlan(specDir).then((plan) => {
        if (plan) setFunctionalPlan(plan);
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

  // Parse markdown bullets into list items
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
```

- [ ] **Stap 2: Typecheck**

```bash
npm run typecheck 2>&1 | grep "PlanReviewView" | head -5
```

- [ ] **Stap 3: Commit**

```bash
git add apps/frontend/src/renderer/components/pipeline/PlanReviewView.tsx
git commit -m "feat(pipeline): add PlanReviewView component"
```

---

### Task 5: ExecutionView — live tasklist met checkboxes

**Files:**
- Create: `apps/frontend/src/renderer/components/pipeline/ExecutionView.tsx`

- [ ] **Stap 1: Lees hoe implementation_plan.json wordt geladen in de bestaande code**

```bash
grep -r "implementation_plan\|TASK_PLAN_STATE" apps/frontend/src --include="*.ts" --include="*.tsx" -l | head -5
```

Lees het gevonden bestand om het IPC patroon te begrijpen.

- [ ] **Stap 2: Schrijf ExecutionView.tsx**

Maak `apps/frontend/src/renderer/components/pipeline/ExecutionView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { cn } from '../../lib/utils';

interface ExecutionViewProps {
  taskId: string;
  onComplete: () => void;
}

export function ExecutionView({ taskId, onComplete }: ExecutionViewProps) {
  const subtasks = usePipelineStore((s) => s.subtasks);
  const logRef = useRef<HTMLDivElement>(null);

  const completed = subtasks.filter((t) => t.status === 'completed').length;
  const total = subtasks.length;
  const allDone = total > 0 && completed === total;

  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [allDone, onComplete]);

  // Subscribe to task plan state updates via existing IPC
  useEffect(() => {
    const setSubtasks = usePipelineStore.getState().setSubtasks;
    const updateSubtaskStatus = usePipelineStore.getState().updateSubtaskStatus;

    // Listen for implementation plan updates (reuse existing TASK_PLAN_STATE channel)
    const cleanup = window.electronAPI.tasks?.onPlanState?.((planState: unknown) => {
      if (!planState || typeof planState !== 'object') return;
      const plan = planState as { phases?: Array<{ subtasks?: Array<{ id: string; description: string; status: string }> }> };
      const allSubtasks = plan.phases?.flatMap((p) => p.subtasks ?? []) ?? [];
      setSubtasks(
        allSubtasks.map((t) => ({
          id: t.id,
          description: t.description,
          status: (t.status === 'completed'
            ? 'completed'
            : t.status === 'in_progress'
              ? 'in_progress'
              : t.status === 'blocked'
                ? 'blocked'
                : 'pending') as 'pending' | 'in_progress' | 'completed' | 'blocked',
        })),
      );
    });

    return cleanup;
  }, [taskId]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'blocked': return '🚫';
      default: return '☐';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Uitvoeren</h2>
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            {completed}/{total} taken afgerond
          </p>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 py-2 border-b border-border">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Agent is aan het starten...
          </p>
        ) : (
          subtasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'flex items-start gap-2 py-1.5 px-2 rounded text-sm transition-colors',
                task.status === 'in_progress' && 'bg-primary/5',
                task.status === 'completed' && 'opacity-60',
              )}
            >
              <span className="mt-0.5 shrink-0">{statusIcon(task.status)}</span>
              <span
                className={cn(
                  task.status === 'completed' && 'line-through text-muted-foreground',
                  task.status === 'in_progress' && 'font-medium',
                )}
              >
                {task.description}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Complete state */}
      {allDone && (
        <div className="px-4 py-3 border-t border-border bg-green-500/5">
          <p className="text-sm text-green-600 font-medium text-center">
            ✅ Alle taken afgerond — ga naar afronden
          </p>
        </div>
      )}

      {/* Terminal log reference */}
      <div ref={logRef} />
    </div>
  );
}
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | grep "ExecutionView" | head -5
```

- [ ] **Stap 4: Commit**

```bash
git add apps/frontend/src/renderer/components/pipeline/ExecutionView.tsx
git commit -m "feat(pipeline): add ExecutionView with live task checklist"
```

---

### Task 6: FinishingView — tests / PR / merge

**Files:**
- Create: `apps/frontend/src/renderer/components/pipeline/FinishingView.tsx`

- [ ] **Stap 1: Schrijf FinishingView.tsx**

Maak `apps/frontend/src/renderer/components/pipeline/FinishingView.tsx`:

```tsx
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
      addFinishProgress(event);
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

      <div className="flex-1 px-4 py-4 space-y-3">
        {/* Action buttons */}
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

        {/* Progress log */}
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

        {/* Loading */}
        {isFinishing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Bezig...
          </div>
        )}

        {/* Done */}
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
```

- [ ] **Stap 2: Commit**

```bash
git add apps/frontend/src/renderer/components/pipeline/FinishingView.tsx
git commit -m "feat(pipeline): add FinishingView with test/PR/merge options"
```

---

### Task 7: PipelineView — hoofdcontainer die alle fases orkestreert

**Files:**
- Create: `apps/frontend/src/renderer/components/pipeline/PipelineView.tsx`
- Create: `apps/frontend/src/renderer/components/pipeline/index.ts`

- [ ] **Stap 1: Schrijf PipelineView.tsx**

Maak `apps/frontend/src/renderer/components/pipeline/PipelineView.tsx`:

```tsx
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
}

const PHASE_LABELS = {
  brainstorm: 'Brainstorm',
  plan_writing: 'Plan schrijven',
  plan_review: 'Plan review',
  executing: 'Uitvoeren',
  finishing: 'Afronden',
  done: 'Klaar',
};

export function PipelineView({ taskId, specDir, projectDir }: PipelineViewProps) {
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
        // Load the functional plan
        window.electronAPI.pipeline.getFunctionalPlan(specDir).then((plan) => {
          if (plan) setFunctionalPlan(plan);
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
    // Start the executor via existing task execution IPC
    window.electronAPI.tasks?.startTask?.(taskId);
  }, [taskId, setPhase]);

  const handleRevise = useCallback(() => {
    setPhase('brainstorm');
    setFunctionalPlan(null);
  }, [setPhase, setFunctionalPlan]);

  const handleExecutionComplete = useCallback(() => {
    setPhase('finishing');
  }, [setPhase]);

  const handleFinishingDone = useCallback(() => {
    // Task is fully done
  }, []);

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
          <BrainstormView onReadyToPlan={handleReadyToPlan} />
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
```

- [ ] **Stap 2: Schrijf index.ts**

Maak `apps/frontend/src/renderer/components/pipeline/index.ts`:

```typescript
export { PipelineView } from './PipelineView';
export { BrainstormView } from './BrainstormView';
export { PlanReviewView } from './PlanReviewView';
export { ExecutionView } from './ExecutionView';
export { FinishingView } from './FinishingView';
```

- [ ] **Stap 3: Typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

Los alle errors op.

- [ ] **Stap 4: Commit**

```bash
git add apps/frontend/src/renderer/components/pipeline/
git commit -m "feat(pipeline): add PipelineView orchestrator"
```

---

### Task 8: Integreer PipelineView in de app

**Files:**
- Modify: het bestaande taakdetail-scherm (zoek waar `TaskChatPhase` of spec-review wordt weergegeven)

- [ ] **Stap 1: Zoek de integratieplek**

```bash
grep -r "TaskChatPhase\|spec_review\|plan_review\|brainstorming" apps/frontend/src/renderer --include="*.tsx" -l
```

Lees de gevonden component(en) om te begrijpen hoe de huidige pipeline wordt weergegeven.

- [ ] **Stap 2: Vervang pipeline rendering door PipelineView**

In het gevonden component, vervang de oude fase-logica door:

```tsx
import { PipelineView } from '../pipeline';

// Waar de oude spec/coding/qa fase-weergave stond:
<PipelineView
  taskId={task.id}
  specDir={task.specDir}   // pas aan naar de juiste prop
  projectDir={project.path}
/>
```

- [ ] **Stap 3: Verwijder resterende `PipelinePhasePlaceholder` referenties**

```bash
grep -r "PipelinePhasePlaceholder" apps/frontend/src --include="*.tsx" -l
```

Vervang alle placeholders door de echte `PipelineView`.

- [ ] **Stap 4: Typecheck + linting**

```bash
npm run typecheck 2>&1 | head -40
npm run lint 2>&1 | head -20
```

Los alle errors op.

- [ ] **Stap 5: Build test**

```bash
npm run build 2>&1 | tail -10
```

Verwacht: succesvolle build zonder errors.

- [ ] **Stap 6: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): integrate PipelineView — superpowers flow complete"
```

---

### Task 9: Eindverificatie frontend

- [ ] **Stap 1: Controleer dat oude views weg zijn**

```bash
grep -r "TaskChatPhase\|SpecPhase\|QaPhase\|spec_review\|plan_review" apps/frontend/src/renderer --include="*.tsx" | grep -v "pipeline-store\|pipeline-handlers\|PipelineView"
```

Verwacht: geen resultaten (of alleen in comments).

- [ ] **Stap 2: Volledige typecheck**

```bash
cd apps/frontend && npm run typecheck
```

Verwacht: 0 errors.

- [ ] **Stap 3: Linting**

```bash
npm run lint
```

Verwacht: 0 errors.

- [ ] **Stap 4: Build**

```bash
npm run build 2>&1 | tail -5
```

Verwacht: succesvolle build.

- [ ] **Stap 5: Bump versie en final commit**

```bash
cd ../..
node scripts/bump-version.js minor
# Update CHANGELOG.md
git add -A && git commit --amend --no-edit
```
