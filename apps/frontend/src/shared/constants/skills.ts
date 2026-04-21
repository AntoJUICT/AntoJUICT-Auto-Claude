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
  { id: 'inbox',        label: 'Inbox',         skill: null,               color: '#475569' },
  { id: 'brainstorming',label: 'Brainstorming',  skill: 'brainstorming',   color: '#6366f1' },
  { id: 'planning',     label: 'Planning',        skill: 'writing-plans',  color: '#f59e0b' },
  { id: 'executing',    label: 'Executing',       skill: 'executing-plans', color: '#10b981' },
  { id: 'verifying',    label: 'Verifying',       skill: 'verification',   color: '#3b82f6' },
  { id: 'done',         label: 'Done',            skill: null,              color: '#8b5cf6' },
] as const;
