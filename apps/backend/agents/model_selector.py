from enum import Enum

HAIKU = 'claude-haiku-4-5-20251001'
SONNET = 'claude-sonnet-4-6'
OPUS = 'claude-opus-4-7'

COMPLEX_FILE_THRESHOLD = 3


class AgentRole(Enum):
    BRAINSTORMING = 'brainstorming'
    PLANNING = 'planning'
    IMPLEMENTER = 'implementer'
    SPEC_REVIEWER = 'spec_reviewer'
    QUALITY_REVIEWER = 'quality_reviewer'
    FINAL_REVIEWER = 'final_reviewer'


_ROLE_MODELS: dict[AgentRole, str] = {
    AgentRole.BRAINSTORMING: OPUS,
    AgentRole.PLANNING: OPUS,
    AgentRole.SPEC_REVIEWER: SONNET,
    AgentRole.QUALITY_REVIEWER: SONNET,
    AgentRole.FINAL_REVIEWER: OPUS,
}


class ModelSelector:
    def __init__(self, override: str | None = None) -> None:
        self._override = override

    def model_for(self, role: AgentRole, *, file_count: int = 1) -> str:
        if self._override:
            return self._override
        if role == AgentRole.IMPLEMENTER:
            return HAIKU if file_count < COMPLEX_FILE_THRESHOLD else SONNET
        return _ROLE_MODELS[role]
