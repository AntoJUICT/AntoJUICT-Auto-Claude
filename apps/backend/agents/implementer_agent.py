"""
Implementer Agent
=================

Implements a single subtask from the implementation plan.
Follows TDD and outputs a STATUS line indicating completion or blockage.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "implementer.md"

# Regex to extract the STATUS line from agent output
_STATUS_RE = re.compile(
    r"^STATUS:\s*(DONE|BLOCKED|NEEDS_CONTEXT)(?::\s*(.+))?$",
    re.MULTILINE,
)


def parse_status(output: str) -> tuple[str, str | None]:
    """
    Parse the STATUS line from implementer agent output.

    Args:
        output: Raw output text from the implementer agent

    Returns:
        Tuple of (status, detail) where:
        - status is one of: "DONE", "BLOCKED", "NEEDS_CONTEXT", "UNKNOWN"
        - detail is the reason/context string for BLOCKED/NEEDS_CONTEXT, or None
    """
    match = _STATUS_RE.search(output)
    if not match:
        return "UNKNOWN", None
    status = match.group(1)
    detail = match.group(2).strip() if match.group(2) else None
    return status, detail


async def run(
    design_spec: str,
    plan: dict,
    subtask: dict,
    send_back_note: str | None = None,
    *,
    project_dir: Path,
    spec_dir: Path,
    model: str,
) -> str:
    """
    Run the implementer agent to implement a single subtask.

    Args:
        design_spec: The design specification text
        plan: The full implementation plan dict (with "subtasks" key)
        subtask: The specific subtask dict to implement
        send_back_note: Optional note from a reviewer requesting changes
        project_dir: Root directory of the project
        spec_dir: Directory to store spec artefacts
        model: Claude model identifier to use

    Returns:
        The full output text from the implementer agent (including STATUS line)
    """
    from core.client import create_client
    from core.error_utils import safe_receive_messages
    from phase_config import get_fast_mode, get_model_betas, get_thinking_kwargs_for_model, resolve_model_id

    prompt_template = _PROMPT_FILE.read_text(encoding="utf-8")

    subtask_section = (
        f"## Subtask\n\n"
        f"**ID**: {subtask.get('id', 'unknown')}\n"
        f"**Title**: {subtask.get('title', 'unknown')}\n\n"
        f"**Description**:\n{subtask.get('description', '')}\n\n"
        f"**Files to Create**: {subtask.get('files_to_create', [])}\n"
        f"**Files to Modify**: {subtask.get('files_to_modify', [])}\n\n"
        f"**Acceptance Criteria**:\n"
        + "\n".join(f"- {c}" for c in subtask.get("acceptance_criteria", []))
    )

    plan_summary = (
        f"## Full Plan Summary\n\n"
        f"Total subtasks: {len(plan.get('subtasks', []))}\n"
        f"Subtask IDs: {[s.get('id') for s in plan.get('subtasks', [])]}\n"
    )

    send_back_section = ""
    if send_back_note:
        send_back_section = (
            f"\n## Send-Back Note from Reviewer\n\n"
            f"{send_back_note}\n\n"
            f"**You MUST address all points in this note before marking STATUS: DONE.**\n"
        )

    prompt = (
        f"{prompt_template}\n\n"
        f"---\n\n"
        f"## Design Specification\n\n"
        f"{design_spec}\n\n"
        f"{plan_summary}\n\n"
        f"{subtask_section}\n"
        f"{send_back_section}\n"
        f"**Project Directory**: {project_dir}\n"
        f"**Spec Directory**: {spec_dir}\n"
    )

    resolved_model = resolve_model_id(model)
    betas = get_model_betas(resolved_model)
    fast_mode = get_fast_mode(spec_dir)
    thinking_kwargs = get_thinking_kwargs_for_model(resolved_model, "low")

    client = create_client(
        project_dir,
        spec_dir,
        resolved_model,
        agent_type="sp_implementer",
        betas=betas,
        fast_mode=fast_mode,
        **thinking_kwargs,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="implementer_agent"):
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)

    print()
    status, detail = parse_status(response_text)
    logger.info(
        "Implementer agent completed: status=%s detail=%s output_length=%d",
        status,
        detail,
        len(response_text),
    )
    return response_text
