"""
Quality Reviewer Agent
======================

Performs a quality review of an implementation beyond acceptance criteria.
Checks correctness, security, maintainability, completeness, and performance.
Outputs APPROVED or ISSUES with severity-tagged items.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "quality_reviewer.md"


def _parse_review_output(text: str) -> tuple[bool, list[str]]:
    """
    Parse quality reviewer output into (approved, issues).

    Args:
        text: Raw output from the quality reviewer agent

    Returns:
        Tuple of (approved, issues) where:
        - approved is True if output contains APPROVED (and not ISSUES)
        - issues is a list of issue strings with severity (empty if approved)
    """
    text = text.strip()
    if re.search(r"^\s*APPROVED\s*$", text, re.MULTILINE) and not re.search(
        r"^\s*ISSUES\b", text, re.MULTILINE
    ):
        return True, []

    # Extract issues after the ISSUES header
    issues = []
    lines = text.splitlines()
    in_issues = False
    for line in lines:
        if re.search(r"^\s*ISSUES\s*$", line):
            in_issues = True
            continue
        if in_issues:
            stripped = line.strip()
            if stripped.startswith("-"):
                issues.append(stripped[1:].strip())
            elif stripped and not stripped.startswith("#"):
                issues.append(stripped)

    return False, issues


async def run(
    subtask: dict,
    impl_output: str,
    *,
    project_dir: Path,
    spec_dir: Path,
    model: str,
) -> tuple[bool, list[str]]:
    """
    Run the quality reviewer agent.

    Args:
        subtask: The subtask dict (for context about what was implemented)
        impl_output: The full output text from the implementer agent
        project_dir: Root directory of the project
        spec_dir: Directory to store spec artefacts
        model: Claude model identifier to use

    Returns:
        Tuple of (approved, issues) where:
        - approved is True if quality is acceptable
        - issues is a list of severity-tagged issue strings (empty if approved)
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

    prompt = (
        f"{prompt_template}\n\n"
        f"---\n\n"
        f"## Subtask Context\n\n"
        f"**ID**: {subtask.get('id', 'unknown')}\n"
        f"**Title**: {subtask.get('title', 'unknown')}\n"
        f"**Description**: {subtask.get('description', '')}\n\n"
        f"## Implementation Output\n\n"
        f"{impl_output}\n\n"
        f"**Project Directory**: {project_dir}\n"
        f"**Spec Directory**: {spec_dir}\n"
    )

    resolved_model = resolve_model_id(model)
    betas = get_model_betas(resolved_model)
    fast_mode = get_fast_mode(spec_dir)
    thinking_kwargs = get_thinking_kwargs_for_model(resolved_model, "high")

    client = create_client(
        project_dir,
        spec_dir,
        resolved_model,
        agent_type="sp_quality_reviewer",
        betas=betas,
        fast_mode=fast_mode,
        **thinking_kwargs,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="quality_reviewer_agent"):
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)

    print()
    approved, issues = _parse_review_output(response_text)
    logger.info(
        "Quality reviewer completed: approved=%s issues=%d",
        approved,
        len(issues),
    )
    return approved, issues
