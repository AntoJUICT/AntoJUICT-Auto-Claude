"""
Agents Module
=============

Modular agent system for autonomous coding.

This module provides:
- run_autonomous_agent: Main coder agent loop
- run_followup_planner: Follow-up planner for completed specs
- Memory management (Graphiti + file-based fallback)
- Session management and post-processing
- Utility functions for git and plan management

Superpowers pipeline agents:
- ModelSelector: Role-based model selection
- PipelineOrchestrator: State machine for the superpowers workflow
- brainstorming_agent.run: Produces a design specification
- planning_agent.run: Breaks spec into subtasks (returns JSON plan)
- implementer_agent.run / parse_status: Implements a subtask
- spec_reviewer_agent.run: Checks implementation against acceptance criteria
- quality_reviewer_agent.run: Quality review beyond acceptance criteria
- final_reviewer_agent.run: Final review before PR_READY

Uses lazy imports to avoid circular dependencies.
"""

# Explicit import required by CodeQL static analysis
# (CodeQL doesn't recognize __getattr__ dynamic exports)
from .utils import sync_spec_to_source

# Superpowers pipeline — import directly (no circular deps)
from .model_selector import AgentRole, ModelSelector
from .pipeline_orchestrator import PipelineOrchestrator, PipelineState
from . import (
    brainstorming_agent,
    final_reviewer_agent,
    implementer_agent,
    planning_agent,
    quality_reviewer_agent,
    spec_reviewer_agent,
)

__all__ = [
    # Main API
    "run_autonomous_agent",
    "run_followup_planner",
    # Memory
    "debug_memory_system_status",
    "get_graphiti_context",
    "save_session_memory",
    "save_session_to_graphiti",
    # Session
    "run_agent_session",
    "post_session_processing",
    # Utils
    "get_latest_commit",
    "get_commit_count",
    "load_implementation_plan",
    "find_subtask_in_plan",
    "find_phase_for_subtask",
    "sync_spec_to_source",
    # Constants
    "AUTO_CONTINUE_DELAY_SECONDS",
    "HUMAN_INTERVENTION_FILE",
    # Superpowers pipeline
    "AgentRole",
    "ModelSelector",
    "PipelineOrchestrator",
    "PipelineState",
    "brainstorming_agent",
    "final_reviewer_agent",
    "implementer_agent",
    "planning_agent",
    "quality_reviewer_agent",
    "spec_reviewer_agent",
]


def __getattr__(name):
    """Lazy imports to avoid circular dependencies."""
    if name in ("AUTO_CONTINUE_DELAY_SECONDS", "HUMAN_INTERVENTION_FILE"):
        from .base import AUTO_CONTINUE_DELAY_SECONDS, HUMAN_INTERVENTION_FILE

        return locals()[name]
    elif name == "run_autonomous_agent":
        from .coder import run_autonomous_agent

        return run_autonomous_agent
    elif name in (
        "debug_memory_system_status",
        "get_graphiti_context",
        "save_session_memory",
        "save_session_to_graphiti",
    ):
        from .memory_manager import (
            debug_memory_system_status,
            get_graphiti_context,
            save_session_memory,
            save_session_to_graphiti,
        )

        return locals()[name]
    elif name == "run_followup_planner":
        from .planner import run_followup_planner

        return run_followup_planner
    elif name in ("post_session_processing", "run_agent_session"):
        from .session import post_session_processing, run_agent_session

        return locals()[name]
    elif name in (
        "find_phase_for_subtask",
        "find_subtask_in_plan",
        "get_commit_count",
        "get_latest_commit",
        "load_implementation_plan",
        "sync_spec_to_source",
    ):
        from .utils import (
            find_phase_for_subtask,
            find_subtask_in_plan,
            get_commit_count,
            get_latest_commit,
            load_implementation_plan,
            sync_spec_to_source,
        )

        return locals()[name]
    raise AttributeError(f"module 'agents' has no attribute '{name}'")
