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

  // Loading state — true while restoreState is resolving on task open
  isStateLoaded: boolean;

  // Brainstorm
  messages: ChatMessage[];
  specSummary: string | null;
  isBrainstormLoading: boolean;

  // Plan writing
  planWritingProgress: string;
  planWritingSteps: string[];
  isPlanWriting: boolean;

  // Plan review
  functionalPlan: string | null;

  // Executing
  subtasks: Array<{ id: string; description: string; status: 'pending' | 'in_progress' | 'completed' | 'blocked' }>;

  // Finishing
  finishProgress: Array<{ status: string; message: string }>;
  isFinishing: boolean;

  // Visual Companion
  visualUrl: string | null;

  // Actions
  setPhase: (phase: PipelinePhase) => void;
  setTaskContext: (taskId: string, specDir: string, projectDir: string) => void;
  addMessage: (msg: ChatMessage) => void;
  setSpecSummary: (summary: string) => void;
  setBrainstormLoading: (v: boolean) => void;
  setPlanWritingProgress: (msg: string) => void;
  addPlanWritingStep: (msg: string) => void;
  setIsPlanWriting: (v: boolean) => void;
  setFunctionalPlan: (plan: string | null) => void;
  setSubtasks: (tasks: PipelineState['subtasks']) => void;
  updateSubtaskStatus: (id: string, status: PipelineState['subtasks'][number]['status']) => void;
  addFinishProgress: (event: { status: string; message: string }) => void;
  setIsFinishing: (v: boolean) => void;
  setVisualUrl: (url: string | null) => void;
  loadPersistedState: (
    messages: ChatMessage[],
    phase: PipelinePhase,
    specSummary?: string | null,
    functionalPlan?: string | null
  ) => void;
  reset: () => void;
}

const initialState = {
  phase: 'brainstorm' as PipelinePhase,
  taskId: null,
  specDir: null,
  projectDir: null,
  isStateLoaded: false,
  messages: [],
  specSummary: null,
  isBrainstormLoading: false,
  planWritingProgress: '',
  planWritingSteps: [],
  isPlanWriting: false,
  functionalPlan: null,
  subtasks: [],
  finishProgress: [],
  isFinishing: false,
  visualUrl: null,
};

export const usePipelineStore = create<PipelineState>((set) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),
  setTaskContext: (taskId, specDir, projectDir) => set({ taskId, specDir, projectDir }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSpecSummary: (specSummary) => set({ specSummary }),
  setBrainstormLoading: (isBrainstormLoading) => set({ isBrainstormLoading }),
  setPlanWritingProgress: (planWritingProgress) => set({ planWritingProgress }),
  addPlanWritingStep: (msg) => set((s) => ({ planWritingSteps: [...s.planWritingSteps, msg] })),
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
  setVisualUrl: (visualUrl) => set({ visualUrl }),
  loadPersistedState: (messages, phase, specSummary, functionalPlan) =>
    set({ ...initialState, isStateLoaded: true, messages, phase, specSummary: specSummary ?? null, functionalPlan: functionalPlan ?? null }),
  reset: () => set(initialState),
}));
