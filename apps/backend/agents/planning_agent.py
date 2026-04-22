"""
Planning Agent
==============

Breaks a design specification into an ordered list of implementation subtasks.
Outputs a structured JSON plan with subtasks, file lists, and acceptance criteria.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "planning.md"


def _extract_json(text: str) -> str:
    """Extract JSON from agent output, stripping markdown fences if present."""
    text = text.strip()
    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence_match:
        return fence_match.group(1).strip()
    # Find the first { and last } as a fallback
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        return text[start : end + 1]
    return text


async def run(
    design_spec: str,
    *,
    project_dir: Path,
    spec_dir: Path,
    model: str,
) -> dict:
    """
    Run the planning agent to produce an implementation plan.

    Args:
        design_spec: The design specification text from BrainstormingAgent
        project_dir: Root directory of the project
        spec_dir: Directory to store spec artefacts
        model: Claude model identifier to use

    Returns:
        Parsed plan dict with a "subtasks" key containing a list of subtask dicts.

    Raises:
        ValueError: If the agent output cannot be parsed as valid JSON
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
        f"## Design Specification\n\n"
        f"{design_spec}\n\n"
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
        agent_type="sp_planning",
        betas=betas,
        fast_mode=fast_mode,
        **thinking_kwargs,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="planning_agent"):
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)

    print()
    logger.info("Planning agent completed, output length=%d", len(response_text))

    json_str = _extract_json(response_text)
    try:
        plan = json.loads(json_str)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Planning agent did not return valid JSON.\n"
            f"JSON error: {exc}\n"
            f"Raw output (first 500 chars):\n{response_text[:500]}"
        ) from exc

    if "subtasks" not in plan:
        raise ValueError(
            f"Planning agent JSON missing required 'subtasks' key.\n"
            f"Keys found: {list(plan.keys())}"
        )

    return plan
