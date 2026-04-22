"""
Final Reviewer Agent
====================

Performs a final review of the entire implementation against the design spec.
Used before PR_READY state to verify all subtasks together meet the spec.
Outputs APPROVED or ISSUES with a description of what must be fixed.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "final_reviewer.md"


def _parse_review_output(text: str) -> tuple[bool, str]:
    """
    Parse final reviewer output into (approved, description).

    Args:
        text: Raw output from the final reviewer agent

    Returns:
        Tuple of (approved, description) where:
        - approved is True if output contains APPROVED (and not ISSUES)
        - description is the issues text (empty string if approved)
    """
    text = text.strip()
    if re.search(r"^\s*APPROVED\s*$", text, re.MULTILINE) and not re.search(
        r"^\s*ISSUES\b", text, re.MULTILINE
    ):
        return True, ""

    # Extract description after ISSUES header
    match = re.search(r"^\s*ISSUES\s*\n+([\s\S]+)", text, re.MULTILINE)
    if match:
        description = match.group(1).strip()
    else:
        # Fallback: anything after "ISSUES" on the same line or next
        description = re.sub(r"^\s*ISSUES\s*", "", text, count=1).strip()

    return False, description


async def run(
    design_spec: str,
    plan: dict,
    *,
    project_dir: Path,
    spec_dir: Path,
    model: str,
) -> tuple[bool, str]:
    """
    Run the final reviewer agent.

    Args:
        design_spec: The original design specification text
        plan: The full implementation plan dict (with "subtasks" key)
        project_dir: Root directory of the project
        spec_dir: Directory to store spec artefacts
        model: Claude model identifier to use

    Returns:
        Tuple of (approved, description) where:
        - approved is True if the implementation is ready to merge
        - description is a string describing issues (empty string if approved)
    """
    from core.client import create_client
    from core.error_utils import safe_receive_messages
    from phase_config import (
        get_fast_mode,
        get_model_betas,
        get_thinking_kwargs_for_model,
        resolve_model_id,
    )

    prompt_template = _PROMPT_FILE.read_text(encoding="utf-8")

    subtask_summary = "\n".join(
        f"- [{s.get('id', '?')}] {s.get('title', s.get('description', '?'))}"
        for s in plan.get("subtasks", [])
    )

    prompt = (
        f"{prompt_template}\n\n"
        f"---\n\n"
        f"## Design Specification\n\n"
        f"{design_spec}\n\n"
        f"## Implementation Plan Summary\n\n"
        f"Total subtasks completed: {len(plan.get('subtasks', []))}\n\n"
        f"{subtask_summary}\n\n"
        f"**Project Directory**: {project_dir}\n"
        f"**Spec Directory**: {spec_dir}\n"
        f"\nPlease read the project files in the spec directory and project directory "
        f"to evaluate the implementation against the design specification.\n"
    )

    resolved_model = resolve_model_id(model)
    betas = get_model_betas(resolved_model)
    fast_mode = get_fast_mode(spec_dir)
    thinking_kwargs = get_thinking_kwargs_for_model(resolved_model, "high")

    client = create_client(
        project_dir,
        spec_dir,
        resolved_model,
        agent_type="sp_final_reviewer",
        betas=betas,
        fast_mode=fast_mode,
        **thinking_kwargs,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="final_reviewer_agent"):
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)

    print()
    approved, description = _parse_review_output(response_text)
    logger.info(
        "Final reviewer completed: approved=%s description_length=%d",
        approved,
        len(description),
    )
    return approved, description
