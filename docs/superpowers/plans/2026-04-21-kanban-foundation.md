# Kanban Skill Pipeline — Plan A: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 10 old pipeline statuses with 6 skill-based statuses and wire the IPC mapping so the backend keeps emitting old names while the frontend works entirely with new ones.

**Architecture:** New `TaskStatus` type (`inbox | brainstorming | planning | executing | verifying | done`), new `TaskReviewState` field on Task (replaces review columns), mapping in `useIpc.ts` from backend status → frontend status. Store and execution-handlers updated to use new names.

**Tech Stack:** TypeScript, Zustand, Electron IPC, react-i18next

---

### Task 1: Create `skills.ts` constants

**Files:**
- Create: `apps/frontend/src/shared/constants/skills.ts`

- [ ] **Step 1: Write the file**

```typescript
// apps/frontend/src/shared/constants/skills.ts

export interface SkillStep {
  id: string;
  label: string;
}

export const SKILL_CHECKLISTS: Record<string, SkillStep[]> = {
  brainstorming: [
    { id: 'explore',    label: 'Explore project context' },
    { id: 'questions',  label: 'Clarifying questions' },
    { id: 'approaches', label: 'Propose approaches' },
    { id: 'design',     label: 'Present design' },
    { id: 'spec',       label: 'Write & commit spec' },
  ],
  'writing-plans': [
    { id: 'read',      label: 'Read design doc' },
    { id: 'breakdown', label: 'Break into tasks' },
    { id: 'plan',      label: 'Write implementation plan' },
  ],
  'executing-plans': [
    { id: 'worktree', label: 'Set up worktree' },
    { id: 'execute',  label: 'Execute subtasks' },
    { id: 'tests',    label: 'Run tests' },
    { id: 'fixes',    label: 'Fix issues' },
    { id: 'commit',   label: 'Commit & push' },
  ],
  verification: [
    { id: 'requirements', label: 'Check all requirements' },
    { id: 'tests',        label: 'Run full test suite' },
    { id: 'review',       label: 'Code review' },
  ],
};

export const SKILL_COLUMN_META = [
  { id: 'inbox',       label: 'Inbox',         skill: null,              color: '#475569' },
  { id: 'brainstorming',label: 'Brainstorming', skill: 'brainstorming',  color: '#6366f1' },
  { id: 'planning',    label: 'Planning',       skill: 'writing-plans',  color: '#f59e0b' },
  { id: 'executing',   label: 'Executing',      skill: 'executing-plans',color: '#10b981' },
  { id: 'verifying',   label: 'Verifying',      skill: 'verification',   color: '#3b82f6' },
  { id: 'done',        label: 'Done',           skill: null,              color: '#8b5cf6' },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/shared/constants/skills.ts
git commit -m "feat: add skill checklists and column metadata constants"
```

---

### Task 2: Update TaskStatus type and add new types

**Files:**
- Modify: `apps/frontend/src/shared/types/task.ts:8-24`

- [ ] **Step 1: Replace lines 8–24 in `task.ts`**

Find this block (lines 8–24):
```typescript
export type TaskStatus =
  | 'backlog'
  | 'brainstorming'
  | 'spec_review'
  | 'planning'
  | 'plan_review'
  | 'in_progress'
  | 'preview'
  | 'pr_ready'
  | 'done'
  | 'error';

// Maps task status columns to ordered task IDs for kanban board reordering
export type TaskOrderState = Record<TaskStatus, string[]>;

// Reason why a task was sent back (used in sendBack IPC call)
export type SendBackTarget = 'spec_review' | 'plan_review';
```

Replace with:
```typescript
export type TaskStatus =
  | 'inbox'
  | 'brainstorming'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'done';

// Maps task status columns to ordered task IDs for kanban board reordering
export type TaskOrderState = Record<TaskStatus, string[]>;

// IPC contract with backend — kept for sendBack calls
export type SendBackTarget = 'spec_review' | 'plan_review';

// Review state — replaces review columns (badge on card instead)
export type TaskReviewState = 'none' | 'spec_review' | 'plan_review' | 'approval';

// Skill progress shown on task card
export interface TaskSkillProgress {
  skill: 'brainstorming' | 'writing-plans' | 'executing-plans' | 'verification' | null;
  currentStepIndex: number;
  totalSteps: number;
}
```

- [ ] **Step 2: Add `reviewState` and `skillProgress` to the Task interface**

Find the Task interface (around line 269):
```typescript
export interface Task {
  id: string;
  specId: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  subtasks: Subtask[];
  qaReport?: QAReport;
```

Add two fields after `status: TaskStatus;`:
```typescript
  reviewState: TaskReviewState;
  skillProgress?: TaskSkillProgress;
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/shared/types/task.ts
git commit -m "feat: replace old TaskStatus with 6 skill-based statuses, add TaskReviewState"
```

---

### Task 3: Update task constants

**Files:**
- Modify: `apps/frontend/src/shared/constants/task.ts:13-69`

- [ ] **Step 1: Replace `TASK_STATUS_COLUMNS`, `TASK_STATUS_LABELS`, `TASK_STATUS_COLORS`, `TASK_STATUS_PRIORITY` (lines 13–69)**

Find lines 13–69 and replace with:
```typescript
// Task status columns in Kanban board order
export const TASK_STATUS_COLUMNS = [
  'inbox',
  'brainstorming',
  'planning',
  'executing',
  'verifying',
  'done',
] as const;

export type TaskStatusColumn = typeof TASK_STATUS_COLUMNS[number];

// Status label translation keys (use with t() from react-i18next)
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox:         'kanban:columns.inbox',
  brainstorming: 'kanban:columns.brainstorming',
  planning:      'kanban:columns.planning',
  executing:     'kanban:columns.executing',
  verifying:     'kanban:columns.verifying',
  done:          'kanban:columns.done',
};

// Status colors for UI (Tailwind classes)
export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  inbox:         'bg-muted text-muted-foreground',
  brainstorming: 'bg-purple-500/10 text-purple-400',
  planning:      'bg-amber-500/10 text-amber-400',
  executing:     'bg-emerald-500/10 text-emerald-400',
  verifying:     'bg-blue-500/10 text-blue-400',
  done:          'bg-success/10 text-success',
};

// Status priority for deduplication: higher = more complete
export const TASK_STATUS_PRIORITY: Record<TaskStatus, number> = {
  done:          100,
  verifying:     80,
  executing:     60,
  planning:      40,
  brainstorming: 20,
  inbox:         10,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/shared/constants/task.ts
git commit -m "feat: replace 9-column task constants with 6 skill-stage columns"
```

---

### Task 4: Update i18n

**Files:**
- Modify: `apps/frontend/src/shared/i18n/locales/en/kanban.json`

- [ ] **Step 1: Replace the `columns` key in `kanban.json`**

Find the `columns` block (lines 27–38):
```json
"columns": {
  "backlog": "Backlog",
  "brainstorming": "Brainstorming",
  "spec_review": "Spec Review",
  "planning": "Planning",
  "plan_review": "Plan Review",
  "in_progress": "Coding",
  "preview": "Preview",
  "pr_ready": "PR Ready",
  "done": "Done",
  "error": "Error"
},
```

Replace with:
```json
"columns": {
  "inbox": "Inbox",
  "brainstorming": "Brainstorming",
  "planning": "Planning",
  "executing": "Executing",
  "verifying": "Verifying",
  "done": "Done"
},
```

- [ ] **Step 2: Add skill strings and review badge**

After the `columns` block, add:
```json
"skills": {
  "brainstorming": "brainstorming",
  "writing-plans": "planning",
  "executing-plans": "executing",
  "verification": "verifying"
},
"review": {
  "awaitingReview": "Waiting for you",
  "spec_review": "Spec ready — review needed",
  "plan_review": "Plan ready — review needed",
  "approval": "Ready for approval"
},
"skillSteps": {
  "explore": "Explore project context",
  "questions": "Clarifying questions",
  "approaches": "Propose approaches",
  "design": "Present design",
  "spec": "Write & commit spec",
  "read": "Read design doc",
  "breakdown": "Break into tasks",
  "plan": "Write implementation plan",
  "worktree": "Set up worktree",
  "execute": "Execute subtasks",
  "tests": "Run tests",
  "fixes": "Fix issues",
  "commit": "Commit & push",
  "requirements": "Check all requirements",
  "review": "Code review"
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/shared/i18n/locales/en/kanban.json
git commit -m "feat: update i18n for skill-based kanban columns"
```

---

### Task 5: Add IPC status mapping in `useIpc.ts`

This is the ONE place where old backend status → new frontend status is mapped.

**Files:**
- Modify: `apps/frontend/src/renderer/hooks/useIpc.ts:209-234`

- [ ] **Step 1: Add mapping functions before the `cleanupStatus` listener (around line 208)**

First add this import at the top of `useIpc.ts` (with other shared imports):
```typescript
import { SKILL_CHECKLISTS } from '@shared/constants/skills';
```

Then insert these two functions directly above the `const cleanupStatus = ...` line:
```typescript
// Maps backend pipeline status names to frontend skill-based status + reviewState
function mapBackendStatus(raw: string): { status: TaskStatus; reviewState: TaskReviewState } {
  switch (raw) {
    case 'brainstorming': return { status: 'brainstorming', reviewState: 'none' };
    case 'spec_review':   return { status: 'brainstorming', reviewState: 'spec_review' };
    case 'planning':      return { status: 'planning',      reviewState: 'none' };
    case 'plan_review':   return { status: 'planning',      reviewState: 'plan_review' };
    case 'in_progress':   return { status: 'executing',     reviewState: 'none' };
    case 'preview':       return { status: 'verifying',     reviewState: 'approval' };
    case 'pr_ready':      return { status: 'done',          reviewState: 'none' };
    case 'done':          return { status: 'done',          reviewState: 'none' };
    case 'error':         return { status: 'inbox',         reviewState: 'none' };
    case 'backlog':       return { status: 'inbox',         reviewState: 'none' };
    default:              return { status: 'inbox',         reviewState: 'none' };
  }
}

// Derives which skill is active from a frontend status
function skillForStatus(status: TaskStatus): TaskSkillProgress['skill'] {
  switch (status) {
    case 'brainstorming': return 'brainstorming';
    case 'planning':      return 'writing-plans';
    case 'executing':     return 'executing-plans';
    case 'verifying':     return 'verification';
    default:              return null;
  }
}
```

- [ ] **Step 2: Update the `onTaskStatusChange` listener (lines 209–234)**

Find:
```typescript
const cleanupStatus = window.electronAPI.onTaskStatusChange(
  (taskId: string, status: TaskStatus, projectId?: string) => {
    console.log(`[useIpc] Received TASK_STATUS_CHANGE:`, {
      taskId,
      status,
      projectId
    });
    if (!isTaskForCurrentProject(projectId)) return;
    queueUpdate(taskId, { status });

    if (status === 'done' || status === 'pr_ready') {
      useRoadmapStore.getState().markFeatureDoneBySpecId(taskId);
```

Replace with:
```typescript
const cleanupStatus = window.electronAPI.onTaskStatusChange(
  (taskId: string, rawStatus: string, projectId?: string) => {
    console.log(`[useIpc] Received TASK_STATUS_CHANGE:`, { taskId, rawStatus, projectId });
    if (!isTaskForCurrentProject(projectId)) return;
    const { status, reviewState } = mapBackendStatus(rawStatus);
    const skill = skillForStatus(status);
    const steps = skill ? SKILL_CHECKLISTS[skill] : [];
    const skillProgress: TaskSkillProgress = {
      skill,
      currentStepIndex: 0,  // Reset on status change; updated by progress events
      totalSteps: steps.length,
    };
    queueUpdate(taskId, { status, reviewState, skillProgress });

    if (status === 'done') {
      useRoadmapStore.getState().markFeatureDoneBySpecId(taskId);
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/renderer/hooks/useIpc.ts
git commit -m "feat: add IPC mapping from backend pipeline status to skill-based status"
```

---

### Task 6: Update `execution-handlers.ts` status references

The user-triggered status changes (drag-drop) now arrive with new status names.

**Files:**
- Modify: `apps/frontend/src/main/ipc-handlers/task/execution-handlers.ts`

- [ ] **Step 1: Update auto-stop/start checks (lines 783–791)**

Find:
```typescript
// Auto-stop task when status changes AWAY from 'in_progress' and process IS running
if (status !== 'in_progress' && agentManager.isRunning(taskId)) {
  console.warn('[TASK_UPDATE_STATUS] Stopping task due to status change away from in_progress:', taskId);
  agentManager.killTask(taskId);
}

// Auto-start task when status changes to 'in_progress' and no process is running
if (status === 'in_progress' && !agentManager.isRunning(taskId)) {
```

Replace with:
```typescript
// Auto-stop task when status changes AWAY from 'executing' and process IS running
if (status !== 'executing' && agentManager.isRunning(taskId)) {
  console.warn('[TASK_UPDATE_STATUS] Stopping task due to status change away from executing:', taskId);
  agentManager.killTask(taskId);
}

// Auto-start task when status changes to 'executing' and no process is running
if (status === 'executing' && !agentManager.isRunning(taskId)) {
```

- [ ] **Step 2: Update preview validation (lines 733–761)**

Find:
```typescript
if (status === 'preview') {
```

Replace with:
```typescript
if (status === 'verifying') {
```

- [ ] **Step 3: Update recovery status values (lines ~1099–1124)**

Find:
```typescript
let newStatus: TaskStatus = targetStatus || 'backlog';
```
Replace with:
```typescript
let newStatus: TaskStatus = targetStatus || 'inbox';
```

Find:
```typescript
newStatus = 'preview';
```
Replace with:
```typescript
newStatus = 'verifying';
```

Find:
```typescript
newStatus = 'in_progress';
```
Replace with:
```typescript
newStatus = 'executing';
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/task/execution-handlers.ts
git commit -m "feat: update execution-handlers to use new skill-based status names"
```

---

### Task 7: Update `kanban-settings-store.ts`

**Files:**
- Modify: `apps/frontend/src/renderer/stores/kanban-settings-store.ts:1-4`

- [ ] **Step 1: The store imports `TASK_STATUS_COLUMNS` — the import is fine, it will now use the new columns automatically. Run typecheck to verify:**

```bash
cd apps/frontend && npm run typecheck 2>&1 | head -60
```

Expected: Errors in files that still reference old status names. Fix each one:

- Any `'backlog'` → `'inbox'`
- Any `'in_progress'` → `'executing'`
- Any `'spec_review'` | `'plan_review'` (as status, not review) → `'brainstorming'` | `'planning'`
- Any `'preview'` → `'verifying'`
- Any `'pr_ready'` → `'done'`
- Any `'error'` (as status) → `'inbox'`

- [ ] **Step 2: Update `crud-handlers.ts` default status (line 321)**

Find:
```typescript
status: 'backlog',
```
Replace with:
```typescript
status: 'inbox',
```

- [ ] **Step 3: After fixing all typecheck errors, run again to confirm**

```bash
cd apps/frontend && npm run typecheck 2>&1 | grep -c "error TS"
```

Expected: 0 errors (or only errors in test files — those can be fixed separately).

- [ ] **Step 4: Commit all remaining fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors after TaskStatus rename"
```

---

### Task 8: Update `task-store.ts` initial reviewState

**Files:**
- Modify: `apps/frontend/src/renderer/stores/task-store.ts`

- [ ] **Step 1: Find where tasks are loaded/created without `reviewState` and add the default**

Search for where Task objects are constructed (look for `status:` assignments in the store). Add `reviewState: 'none'` to any task object literal that doesn't have it.

Run:
```bash
cd apps/frontend && npm run typecheck 2>&1 | grep "reviewState"
```

Fix each reported location by adding `reviewState: 'none'` or `reviewState: task.reviewState ?? 'none'` as appropriate.

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/renderer/stores/task-store.ts
git commit -m "fix: add reviewState default to task-store task objects"
```
