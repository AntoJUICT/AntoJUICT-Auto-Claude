# Kanban Skill Pipeline — Plan B: Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Plan A (kanban-foundation) must be fully complete and passing typecheck before starting this plan.

**Goal:** Replace `KanbanBoard.tsx` and `TaskCard.tsx` with the new skill-pipeline visual design — 6 skill-stage columns, compact cards with skill badge + progress bar + expandable checklist, and a review badge when human input is needed.

**Architecture:** `KanbanBoard.tsx` uses `SKILL_COLUMN_META` from `skills.ts` for column definitions. `TaskCard.tsx` renders in two states (collapsed / expanded) and reads `task.reviewState` and `task.skillProgress` from the store. A new `SkillChecklist` sub-component handles the expandable checklist.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, DnD Kit, Zustand, react-i18next

---

### Task 1: Rewrite `KanbanBoard.tsx` column definitions

**Files:**
- Modify: `apps/frontend/src/renderer/components/KanbanBoard.tsx`

- [ ] **Step 1: Read the current imports and column-rendering logic (lines 1–120)**

```bash
head -120 apps/frontend/src/renderer/components/KanbanBoard.tsx
```

Identify where `TASK_STATUS_COLUMNS` is used to render columns. It will look like `TASK_STATUS_COLUMNS.map(status => ...)`.

- [ ] **Step 2: Replace the column import and the column map**

In the import block, replace:
```typescript
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from '@shared/constants/task';
```
With:
```typescript
import { TASK_STATUS_COLUMNS, TASK_STATUS_LABELS } from '@shared/constants/task';
import { SKILL_COLUMN_META } from '@shared/constants/skills';
```

Find the column-rendering map (pattern: `TASK_STATUS_COLUMNS.map((status) => (`). Replace the column header rendering to use `SKILL_COLUMN_META` for color and skill name. Example — if current code is:

```typescript
{TASK_STATUS_COLUMNS.map((status) => (
  <DroppableColumn key={status} status={status} ...>
    <div className="column-header">
      {t(TASK_STATUS_LABELS[status])}
    </div>
```

Add the accent color from `SKILL_COLUMN_META`:
```typescript
{TASK_STATUS_COLUMNS.map((status) => {
  const meta = SKILL_COLUMN_META.find(m => m.id === status);
  return (
    <DroppableColumn key={status} status={status} ...>
      <div
        className="column-header"
        style={{ borderTopColor: meta?.color }}
      >
        {t(TASK_STATUS_LABELS[status])}
        {meta?.skill && (
          <span className="column-skill-label">
            {t(`kanban:skills.${meta.skill}`)}
          </span>
        )}
      </div>
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/frontend && npm run typecheck 2>&1 | grep "KanbanBoard"
```

Fix any reported errors.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/KanbanBoard.tsx
git commit -m "feat: update KanbanBoard to use skill-stage column metadata"
```

---

### Task 2: Create `SkillChecklist` sub-component

**Files:**
- Create: `apps/frontend/src/renderer/components/task-card/SkillChecklist.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p apps/frontend/src/renderer/components/task-card
```

- [ ] **Step 2: Write the component**

```typescript
// apps/frontend/src/renderer/components/task-card/SkillChecklist.tsx
import { SKILL_CHECKLISTS } from '@shared/constants/skills';
import type { TaskSkillProgress } from '@shared/types/task';

interface Props {
  skillProgress: TaskSkillProgress;
}

export function SkillChecklist({ skillProgress }: Props) {
  const { skill, currentStepIndex } = skillProgress;
  if (!skill) return null;
  const steps = SKILL_CHECKLISTS[skill] ?? [];

  return (
    <div className="flex flex-col gap-1 bg-black/20 rounded-md p-2 mt-1">
      {steps.map((step, index) => {
        const isDone   = index < currentStepIndex;
        const isActive = index === currentStepIndex;
        return (
          <div
            key={step.id}
            className={`flex items-center gap-2 text-xs ${
              isDone   ? 'text-muted-foreground line-through' :
              isActive ? 'text-foreground font-semibold' :
                         'text-muted-foreground/50'
            }`}
          >
            <span className="shrink-0 w-3 text-center">
              {isDone ? '✓' : isActive ? '▶' : '○'}
            </span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/renderer/components/task-card/SkillChecklist.tsx
git commit -m "feat: add SkillChecklist component for expandable task card detail"
```

---

### Task 3: Create `SkillBadge` sub-component

**Files:**
- Create: `apps/frontend/src/renderer/components/task-card/SkillBadge.tsx`

- [ ] **Step 1: Write the component**

```typescript
// apps/frontend/src/renderer/components/task-card/SkillBadge.tsx
import { SKILL_COLUMN_META } from '@shared/constants/skills';
import type { TaskSkillProgress, TaskReviewState } from '@shared/types/task';
import { useTranslation } from 'react-i18next';

interface Props {
  skillProgress?: TaskSkillProgress;
  reviewState: TaskReviewState;
}

export function SkillBadge({ skillProgress, reviewState }: Props) {
  const { t } = useTranslation('kanban');

  if (reviewState !== 'none') {
    const reviewMessage = t(`review.${reviewState}`);
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-600/60 bg-amber-900/30 px-2 py-1">
        <span className="text-sm">👀</span>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-amber-400">
            {t('review.awaitingReview')}
          </span>
          <span className="text-[10px] text-amber-700">{reviewMessage}</span>
        </div>
      </div>
    );
  }

  if (!skillProgress?.skill) return null;

  const meta = SKILL_COLUMN_META.find(m => m.skill === skillProgress.skill);
  const skillLabel = t(`skills.${skillProgress.skill}`);

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: `${meta?.color}22`, color: meta?.color }}
      >
        {skillLabel}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {skillProgress.currentStepIndex + 1} / {skillProgress.totalSteps}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/renderer/components/task-card/SkillBadge.tsx
git commit -m "feat: add SkillBadge component for task card skill indicator"
```

---

### Task 4: Rewrite `TaskCard.tsx`

**Files:**
- Modify: `apps/frontend/src/renderer/components/TaskCard.tsx`

- [ ] **Step 1: Read the current TaskCard props interface**

```bash
grep -n "TaskCardProps\|interface.*Props\|executionProgress\|PhaseProgressIndicator" apps/frontend/src/renderer/components/TaskCard.tsx | head -20
```

Note all the props the component currently accepts.

- [ ] **Step 2: Add imports for new sub-components**

In the imports section of `TaskCard.tsx`, add:
```typescript
import { useState } from 'react';
import { SkillBadge } from './task-card/SkillBadge';
import { SkillChecklist } from './task-card/SkillChecklist';
import { SKILL_COLUMN_META } from '@shared/constants/skills';
```

- [ ] **Step 3: Add `isExpanded` state inside the component function**

At the top of the `TaskCard` function body, add:
```typescript
const [isExpanded, setIsExpanded] = useState(false);
```

- [ ] **Step 4: Replace the progress/phase section in the render**

Find the section that renders `PhaseProgressIndicator` or `executionProgress`. It will look something like:
```tsx
{task.executionProgress && (
  <PhaseProgressIndicator progress={task.executionProgress} />
)}
```

Replace with:
```tsx
{/* Skill badge — shows active skill or review badge */}
<SkillBadge
  skillProgress={task.skillProgress}
  reviewState={task.reviewState ?? 'none'}
/>

{/* Progress bar */}
{task.skillProgress && task.reviewState === 'none' && (
  <div className="mt-1.5">
    <div className="h-1 w-full rounded-full bg-black/20">
      <div
        className="h-1 rounded-full transition-all"
        style={{
          width: `${Math.round(
            ((task.skillProgress.currentStepIndex) / task.skillProgress.totalSteps) * 100
          )}%`,
          background: SKILL_COLUMN_META.find(
            m => m.skill === task.skillProgress?.skill
          )?.color ?? '#6366f1',
        }}
      />
    </div>
  </div>
)}

{/* Expandable checklist trigger */}
{task.skillProgress?.skill && (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
    className="mt-1 flex w-full items-center justify-between border-t border-border/40 pt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
  >
    <span>
      → {task.skillProgress
        ? `Step ${task.skillProgress.currentStepIndex + 1} of ${task.skillProgress.totalSteps}`
        : ''}
    </span>
    <span>{isExpanded ? '▴' : '▾'}</span>
  </button>
)}

{/* Expanded checklist */}
{isExpanded && task.skillProgress && (
  <SkillChecklist skillProgress={task.skillProgress} />
)}
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/frontend && npm run typecheck 2>&1 | grep "TaskCard"
```

Fix any errors.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/renderer/components/TaskCard.tsx
git commit -m "feat: rewrite TaskCard with skill badge, progress bar, and expandable checklist"
```

---

### Task 5: Remove dead code and old components

**Files:**
- Check and optionally remove: `PhaseProgressIndicator` usage

- [ ] **Step 1: Check if `PhaseProgressIndicator` is used anywhere besides TaskCard**

```bash
grep -r "PhaseProgressIndicator" apps/frontend/src --include="*.tsx" --include="*.ts" -l
```

If only `TaskCard.tsx` used it and you've removed the import, delete the component file:
```bash
# Only if no other files use it:
git rm apps/frontend/src/renderer/components/PhaseProgressIndicator.tsx
```

- [ ] **Step 2: Run the full typecheck one final time**

```bash
cd apps/frontend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run frontend unit tests**

```bash
cd apps/frontend && npm test -- --run 2>&1 | tail -20
```

Fix any failing tests by updating test fixtures to use new status names (e.g., `'backlog'` → `'inbox'`, `'in_progress'` → `'executing'`).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete kanban skill pipeline visual redesign

- 6 skill-stage columns (inbox → brainstorming → planning → executing → verifying → done)
- Task cards show skill badge, progress bar, expandable checklist
- Review badge replaces review columns
- Old pipeline statuses removed"
```
