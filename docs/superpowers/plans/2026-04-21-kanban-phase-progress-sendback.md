# Kanban Phase Progress Bar & Send-Back Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-segment phase completion progress bar to kanban task cards and fix the send-back target logic bug in TaskCard.

**Architecture:** Two tasks. Task 1 creates `PhaseProgressBar.tsx` using TDD — the component reads `completedPhases` from `ExecutionProgress` and renders 4 colored segments. Task 2 wires the component into `TaskCard.tsx` and fixes the one-line `handleSendBack` bug where both non-verifying branches incorrectly returned `spec_review`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Vitest, `@testing-library/react`, `CompletablePhase` from `@shared/constants/phase-protocol`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/frontend/src/renderer/components/task-card/PhaseProgressBar.tsx` | 4-segment progress bar, pure visual component |
| Create | `apps/frontend/src/renderer/components/task-card/__tests__/PhaseProgressBar.test.tsx` | Unit tests for PhaseProgressBar |
| Modify | `apps/frontend/src/renderer/components/TaskCard.tsx` | Add import, add `<PhaseProgressBar>` to JSX, fix `handleSendBack` |

---

### Task 1: PhaseProgressBar component (TDD)

**Files:**
- Create: `apps/frontend/src/renderer/components/task-card/__tests__/PhaseProgressBar.test.tsx`
- Create: `apps/frontend/src/renderer/components/task-card/PhaseProgressBar.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/frontend/src/renderer/components/task-card/__tests__/PhaseProgressBar.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PhaseProgressBar } from '../PhaseProgressBar';

describe('PhaseProgressBar', () => {
  it('renders nothing when completedPhases is empty', () => {
    const { container } = render(<PhaseProgressBar completedPhases={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 4 segments', () => {
    const { container } = render(<PhaseProgressBar completedPhases={['planning']} />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.childElementCount).toBe(4);
  });

  it('first segment has full opacity when planning is complete', () => {
    const { container } = render(<PhaseProgressBar completedPhases={['planning']} />);
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments[0].style.opacity).toBe('1');
    expect(segments[1].style.opacity).toBe('0.15');
    expect(segments[2].style.opacity).toBe('0.15');
    expect(segments[3].style.opacity).toBe('0.15');
  });

  it('all segments have full opacity when all phases complete', () => {
    const { container } = render(
      <PhaseProgressBar completedPhases={['planning', 'coding', 'qa_review', 'qa_fixing']} />
    );
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    for (const seg of segments) {
      expect(seg.style.opacity).toBe('1');
    }
  });

  it('segments have correct colors', () => {
    const { container } = render(
      <PhaseProgressBar completedPhases={['planning', 'coding', 'qa_review', 'qa_fixing']} />
    );
    const bar = container.firstChild as HTMLElement;
    const segments = Array.from(bar.children) as HTMLElement[];
    expect(segments[0].style.backgroundColor).toBe('rgb(245, 158, 11)');   // #f59e0b amber
    expect(segments[1].style.backgroundColor).toBe('rgb(16, 185, 129)');   // #10b981 emerald
    expect(segments[2].style.backgroundColor).toBe('rgb(96, 165, 250)');   // #60a5fa blue-400
    expect(segments[3].style.backgroundColor).toBe('rgb(37, 99, 235)');    // #2563eb blue-600
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/frontend && npm test -- --run PhaseProgressBar
```

Expected: FAIL with `Cannot find module '../PhaseProgressBar'`

- [ ] **Step 3: Write the PhaseProgressBar component**

Create `apps/frontend/src/renderer/components/task-card/PhaseProgressBar.tsx`:

```tsx
import type { CompletablePhase } from '@shared/constants/phase-protocol';

const PHASE_SEGMENTS: { phase: CompletablePhase; color: string }[] = [
  { phase: 'planning', color: '#f59e0b' },
  { phase: 'coding', color: '#10b981' },
  { phase: 'qa_review', color: '#60a5fa' },
  { phase: 'qa_fixing', color: '#2563eb' },
];

interface PhaseProgressBarProps {
  completedPhases: CompletablePhase[];
}

export function PhaseProgressBar({ completedPhases }: PhaseProgressBarProps) {
  if (completedPhases.length === 0) return null;

  return (
    <div className="mt-2 flex gap-px">
      {PHASE_SEGMENTS.map(({ phase, color }) => (
        <div
          key={phase}
          className="h-[3px] flex-1 rounded-sm"
          style={{
            backgroundColor: color,
            opacity: completedPhases.includes(phase) ? 1 : 0.15,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/frontend && npm test -- --run PhaseProgressBar
```

Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/renderer/components/task-card/PhaseProgressBar.tsx apps/frontend/src/renderer/components/task-card/__tests__/PhaseProgressBar.test.tsx
git commit -m "feat: add PhaseProgressBar component with tests"
```

---

### Task 2: Integrate into TaskCard + fix send-back logic

**Files:**
- Modify: `apps/frontend/src/renderer/components/TaskCard.tsx`

Context: `TaskCard.tsx` is large (~750 lines). You need to make three targeted changes:
1. Add an import for `PhaseProgressBar` (top of file, near other task-card imports)
2. Fix `handleSendBack` (around line 284)
3. Add `<PhaseProgressBar>` JSX after the SkillBadge `<div>` block (around line 464)

- [ ] **Step 1: Add the PhaseProgressBar import**

In `apps/frontend/src/renderer/components/TaskCard.tsx`, find this line (around line 21):

```typescript
import { SkillChecklist } from './task-card/SkillChecklist';
```

Add the import directly below it:

```typescript
import { SkillChecklist } from './task-card/SkillChecklist';
import { PhaseProgressBar } from './task-card/PhaseProgressBar';
```

- [ ] **Step 2: Fix the handleSendBack logic**

Find this block (around line 284):

```typescript
const handleSendBack = async () => {
  const target = task.status === 'verifying' ? ('plan_review' as const) : (task.reviewState === 'plan_review' ? ('spec_review' as const) : ('spec_review' as const));
  await window.electronAPI.sendBack(task.id, target);
};
```

Replace it with:

```typescript
const handleSendBack = async () => {
  const target: SendBackTarget =
    task.reviewState === 'plan_review' || task.status === 'verifying'
      ? 'plan_review'
      : 'spec_review';
  await window.electronAPI.sendBack(task.id, target);
};
```

Add `SendBackTarget` as a separate import directly below the existing types import (around line 41):

Find:
```typescript
import type { Task, TaskCategory, TaskStatus } from '../../shared/types';
```

Add below it:
```typescript
import type { Task, TaskCategory, TaskStatus } from '../../shared/types';
import type { SendBackTarget } from '../../shared/types/task';
```

- [ ] **Step 3: Add PhaseProgressBar to the card JSX**

Find the closing `</div>` of the skill badge block. It's the div that starts with `{/* Skill badge — shows active skill or review badge */}` and contains `<SkillBadge>`, the skill progress bar, and `<SkillChecklist>`. The block looks like this at the end:

```tsx
  {/* Expanded checklist */}
  {isExpanded && task.skillProgress && (
    <SkillChecklist skillProgress={task.skillProgress} />
  )}
</div>
```

Add `<PhaseProgressBar>` immediately after that closing `</div>`:

```tsx
  {/* Expanded checklist */}
  {isExpanded && task.skillProgress && (
    <SkillChecklist skillProgress={task.skillProgress} />
  )}
</div>
<PhaseProgressBar completedPhases={task.executionProgress?.completedPhases ?? []} />
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/frontend && npm run typecheck
```

Expected: 0 errors

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/frontend && npm test -- --run
```

Expected: All tests pass (including the PhaseProgressBar tests from Task 1)

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/renderer/components/TaskCard.tsx
git commit -m "feat: integrate PhaseProgressBar into TaskCard, fix handleSendBack target logic"
```
