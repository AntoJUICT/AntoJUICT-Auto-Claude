// apps/frontend/src/shared/constants/skills.ts

export interface SkillStep {
  id: string;
  label: string;
}

export type SkillKey = 'brainstorming' | 'writing-plans' | 'executing-plans' | 'verification';

export const SKILL_CHECKLISTS: Record<SkillKey, SkillStep[]> = {
  brainstorming: [
    { id: 'explore',    label: 'kanban:skillSteps.explore' },
    { id: 'questions',  label: 'kanban:skillSteps.questions' },
    { id: 'approaches', label: 'kanban:skillSteps.approaches' },
    { id: 'design',     label: 'kanban:skillSteps.design' },
    { id: 'spec',       label: 'kanban:skillSteps.spec' },
  ],
  'writing-plans': [
    { id: 'read',      label: 'kanban:skillSteps.read' },
    { id: 'breakdown', label: 'kanban:skillSteps.breakdown' },
    { id: 'plan',      label: 'kanban:skillSteps.plan' },
  ],
  'executing-plans': [
    { id: 'worktree', label: 'kanban:skillSteps.worktree' },
    { id: 'execute',  label: 'kanban:skillSteps.execute' },
    { id: 'tests',    label: 'kanban:skillSteps.tests' },
    { id: 'fixes',    label: 'kanban:skillSteps.fixes' },
    { id: 'commit',   label: 'kanban:skillSteps.commit' },
  ],
  verification: [
    { id: 'requirements', label: 'kanban:skillSteps.requirements' },
    { id: 'tests',        label: 'kanban:skillSteps.tests' },
    { id: 'review',       label: 'kanban:skillSteps.review' },
  ],
};

export const SKILL_COLUMN_META = [
  { id: 'inbox',         skill: null,               color: '#475569' },
  { id: 'brainstorming', skill: 'brainstorming',    color: '#6366f1' },
  { id: 'planning',      skill: 'writing-plans',    color: '#f59e0b' },
  { id: 'executing',     skill: 'executing-plans',  color: '#10b981' },
  { id: 'verifying',     skill: 'verification',     color: '#3b82f6' },
  { id: 'done',          skill: null,               color: '#8b5cf6' },
] as const;
