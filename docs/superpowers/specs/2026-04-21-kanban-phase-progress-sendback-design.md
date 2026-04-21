# Kanban Phase Progress Bar & Send-Back Fix — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-segment phase completion progress bar to kanban task cards, and fix the send-back target logic bug in TaskCard.

**Architecture:** Two focused changes: a new `PhaseProgressBar` component reads `completedPhases` from `ExecutionProgress` and renders a color-coded bar; a one-line fix corrects the `handleSendBack` ternary in `TaskCard.tsx`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, existing `CompletablePhase` type, existing `SKILL_COLUMN_META` color palette.

---

## Files

| Action | Path |
|--------|------|
| Create | `apps/frontend/src/renderer/components/task-card/PhaseProgressBar.tsx` |
| Modify | `apps/frontend/src/renderer/components/TaskCard.tsx` |

No i18n keys needed — the progress bar is purely visual with no text.

---

## Feature 1: PhaseProgressBar Component

### Data Source

`task.executionProgress?.completedPhases: CompletablePhase[]`

Type: `'planning' | 'coding' | 'qa_review' | 'qa_fixing'`

### Segment Definitions

Four fixed segments in order:

| Index | Phase | Color | Hex |
|-------|-------|-------|-----|
| 0 | `planning` | amber | `#f59e0b` |
| 1 | `coding` | emerald | `#10b981` |
| 2 | `qa_review` | blue-400 | `#60a5fa` |
| 3 | `qa_fixing` | blue-600 | `#2563eb` |

### Visual Spec

- **Height:** 3px
- **Width:** full width of card (flex row, segments share space equally)
- **Gap between segments:** 1px (gap-px in Tailwind)
- **Completed segment:** full opacity (`opacity-100`), `rounded-sm`
- **Pending segment:** 15% opacity (`opacity-[15%]`), `rounded-sm`
- **Container:** no rounded corners, no horizontal margin — spans full width of the card content area, positioned at the bottom of the card interior

### Render Condition

Renders only when `completedPhases.length > 0`. Hidden for tasks that have never entered the pipeline.

### Component Interface

```typescript
interface PhaseProgressBarProps {
  completedPhases: CompletablePhase[];
}
```

### Placement in TaskCard

Inserted at the bottom of the card body, after the SkillChecklist/SkillBadge area, before the closing card element. Uses `mt-2` spacing from the content above it.

---

## Feature 2: Send-Back Logic Fix

### Location

`apps/frontend/src/renderer/components/TaskCard.tsx` — `handleSendBack` function.

### Current Bug

```typescript
// Both non-verifying branches return 'spec_review' — the reviewState check is dead code
const target = task.status === 'verifying'
  ? ('plan_review' as const)
  : (task.reviewState === 'plan_review' ? ('spec_review' as const) : ('spec_review' as const));
```

### Fix

```typescript
const target: SendBackTarget =
  task.reviewState === 'plan_review' || task.status === 'verifying'
    ? 'plan_review'   // sends task back to PLANNING column
    : 'spec_review';  // sends task back to BRAINSTORMING column
```

### Mapping

| Condition | `target` | Column task returns to |
|-----------|----------|----------------------|
| `reviewState === 'plan_review'` | `plan_review` | PLANNING |
| `status === 'verifying'` | `plan_review` | PLANNING |
| all other (incl. `reviewState === 'spec_review'`) | `spec_review` | BRAINSTORMING |

---

## What Is Not Changing

- No IPC changes — `TASK_SEND_BACK` channel and handler are correct as-is
- No store changes — `completedPhases` is already emitted via `TASK_EXECUTION_PROGRESS`
- No backend changes — `PipelineOrchestrator.send_back()` is correct
- `ApprovalActions.tsx` is not modified — existing approve/send-back buttons remain as-is
- No new i18n keys
