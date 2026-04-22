from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class PipelineState(Enum):
    BRAINSTORMING = 'brainstorming'
    SPEC_REVIEW = 'spec_review'
    PLANNING = 'planning'
    PLAN_REVIEW = 'plan_review'
    IN_PROGRESS = 'in_progress'
    PREVIEW = 'preview'
    PR_READY = 'pr_ready'
    DONE = 'done'
    ERROR = 'error'


_PHASE_COMPLETIONS: dict[PipelineState, PipelineState] = {
    PipelineState.BRAINSTORMING: PipelineState.SPEC_REVIEW,
    PipelineState.PLANNING: PipelineState.PLAN_REVIEW,
    PipelineState.IN_PROGRESS: PipelineState.PREVIEW,
}

_SEND_BACK_TARGETS: dict[str, PipelineState] = {
    'spec_review': PipelineState.BRAINSTORMING,
    'plan_review': PipelineState.PLANNING,
    'preview': PipelineState.PLANNING,
}


@dataclass
class PipelineOrchestrator:
    task_id: str
    project_path: str
    state: PipelineState = PipelineState.BRAINSTORMING
    send_back_note: str | None = None
    subtask_index: int = 0
    subtasks: list[dict] = field(default_factory=list)

    def complete_phase(self, phase: PipelineState) -> None:
        if self.state != phase:
            raise ValueError(f'Cannot complete {phase}: current state is {self.state}')
        next_state = _PHASE_COMPLETIONS.get(phase)
        if next_state is None:
            raise ValueError(f'No automatic transition from {phase}')
        self.state = next_state

    def approve_spec(self) -> None:
        if self.state != PipelineState.SPEC_REVIEW:
            raise ValueError(f'Cannot approve spec in state {self.state}')
        self.state = PipelineState.PLANNING

    def approve_plan(self) -> None:
        if self.state != PipelineState.PLAN_REVIEW:
            raise ValueError(f'Cannot approve plan in state {self.state}')
        self.state = PipelineState.IN_PROGRESS

    def approve_preview(self) -> None:
        if self.state != PipelineState.PREVIEW:
            raise ValueError(f'Cannot approve preview in state {self.state}')
        self.state = PipelineState.PR_READY

    def send_back(self, *, target: str, note: str | None = None) -> None:
        new_state = _SEND_BACK_TARGETS.get(target)
        if new_state is None:
            raise ValueError(f'Unknown send-back target: {target}')
        self.send_back_note = note
        self.state = new_state
