# Kanban Skill Pipeline — Design

**Datum:** 2026-04-21
**Status:** Goedgekeurd

## Samenvatting

Het Kanban dashboard wordt een visuele weergave van de superpowers skill workflow. De 10 bestaande pipeline-statussen worden vervangen door 6 skill-gebaseerde kolommen. Elke kolom vertegenwoordigt één superpowers skill. Taakkaarten tonen compact welke skill actief is en laten de volledige checklist uitklappen op klik.

## Kolomstructuur

6 kolommen, elk gebaseerd op een superpowers skill:

| Kolom | Skill | Kleur |
|-------|-------|-------|
| Inbox | — (wachtrij) | Grijs `#475569` |
| Brainstorming | `superpowers:brainstorming` | Indigo `#6366f1` |
| Planning | `superpowers:writing-plans` | Amber `#f59e0b` |
| Executing | `superpowers:executing-plans` | Groen `#10b981` |
| Verifying | `superpowers:verification-before-completion` | Blauw `#3b82f6` |
| Done | `superpowers:finishing-a-development-branch` ✓ | Paars `#8b5cf6` |

Wat verdwijnt: `backlog`, `spec_review`, `plan_review`, `in_progress`, `preview`, `pr_ready`, `error` als afzonderlijke statussen of kolommen.

## Kaartontwerp

Elke taakkaart heeft twee visuele states:

**Ingeklapt (standaard):**
- Taaknaam
- Skill-badge (kleurgecodeerd)
- Progressbalk
- Huidige stap als tekstregel
- Pijltje om uit te klappen

**Uitgeklapt (op klik):**
- Alles van ingeklapt
- Volledige skill-checklist met ✓ afgerond / ▶ actief / ○ openstaand

**Review-state (badge op kaart):**
Wanneer menselijke review nodig is, verschijnt een gouden "👀 Wacht op jou" badge op de kaart. De taak blijft in zijn skill-kolom — er is geen aparte review-kolom.

## Data Model

### TaskStatus (nieuw)

```typescript
type TaskStatus = 'inbox' | 'brainstorming' | 'planning' | 'executing' | 'verifying' | 'done'
```

### TaskReviewState (nieuw veld op Task)

```typescript
type TaskReviewState = 'none' | 'spec_review' | 'plan_review' | 'approval'
```

### TaskSkillProgress (vervangt executionProgress)

```typescript
interface SkillStep {
  id: string
  label: string
  completed: boolean
  active: boolean
}

interface TaskSkillProgress {
  skill: 'brainstorming' | 'writing-plans' | 'executing-plans' | 'verification' | null
  steps: SkillStep[]
  currentStepIndex: number
}
```

### Skill checklists (nieuwe constante)

```typescript
// apps/frontend/src/shared/constants/skills.ts
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
}
```

## Backend → Frontend Statusmapping

De Python backend behoudt zijn huidige statusnamen. De IPC-handler in Electron vertaalt naar de nieuwe statussen:

| Backend emitteert | Nieuwe `status` | `reviewState` |
|---|---|---|
| `brainstorming` | `brainstorming` | `none` |
| `spec_review` | `brainstorming` | `spec_review` |
| `planning` | `planning` | `none` |
| `plan_review` | `planning` | `plan_review` |
| `in_progress` | `executing` | `none` |
| `preview` | `verifying` | `approval` |
| `pr_ready` | `done` | `none` |
| `done` | `done` | `none` |
| `error` | `inbox` | `none` (kaart krijgt rode fout-badge) |
| `backlog` | `inbox` | `none` |

## Wat verdwijnt

- `TASK_STATUS_COLUMNS` constante (9 statussen)
- `executionProgress` veld op Task
- `spec_review`, `plan_review`, `preview`, `pr_ready`, `backlog`, `in_progress`, `error` als `TaskStatus` waarden
- Kolommen voor review-gates

## Wat blijft

- Drag-and-drop (DnD Kit)
- Kolom resize / collapse / lock (kanban-settings-store)
- WIP-limit queue (processQueue)
- Zustand stores structuur
- i18n (react-i18next)
- Backend Python-code (geen wijzigingen)

## Betrokken bestanden

**Frontend (wijzigen):**
- `apps/frontend/src/shared/types/task.ts` — nieuwe TaskStatus, TaskReviewState, TaskSkillProgress
- `apps/frontend/src/shared/constants/task.ts` — nieuwe SKILL_COLUMNS, verwijder TASK_STATUS_COLUMNS
- `apps/frontend/src/shared/constants/skills.ts` — nieuw bestand met SKILL_CHECKLISTS
- `apps/frontend/src/renderer/components/KanbanBoard.tsx` — nieuwe kolomdefinities
- `apps/frontend/src/renderer/components/TaskCard.tsx` — nieuw kaartontwerp
- `apps/frontend/src/renderer/stores/task-store.ts` — update status-types
- `apps/frontend/src/renderer/stores/kanban-settings-store.ts` — update kolomnamen
- `apps/frontend/src/main/ipc-handlers/` — statusmapping backend→frontend
- `apps/frontend/src/shared/i18n/locales/en/*.json` — nieuwe i18n-sleutels
- `apps/frontend/src/shared/i18n/locales/fr/*.json` — nieuwe i18n-sleutels
