"""
Brainstorming Agent
===================

Produces a comprehensive design specification for a given task.
Uses Opus to generate a structured design spec covering architecture,
components, data flow, error handling, and testing strategy.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "brainstorming.md"


async def run(
    task_title: str,
    task_description: str,
    *,
    project_dir: Path,
    spec_dir: Path,
    model: str,
) -> str:
    """
    Run the brainstorming agent to produce a design specification.

    Args:
        task_title: Short title of the task
        task_description: Full description of what needs to be built
        project_dir: Root directory of the project
        spec_dir: Directory to store spec artefacts
        model: Claude model identifier to use

    Returns:
        The full design specification text produced by the agent
    """
    from core.client import create_client
    from core.error_utils import safe_receive_messages
    from phase_config import get_fast_mode, get_model_betas, get_thinking_kwargs_for_model, resolve_model_id

    prompt_template = _PROMPT_FILE.read_text(encoding="utf-8")
    prompt = (
        f"{prompt_template}\n\n"
        f"---\n\n"
        f"## Task\n\n"
        f"**Title**: {task_title}\n\n"
        f"**Description**:\n{task_description}\n\n"
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
        agent_type="brainstorming",
        betas=betas,
        fast_mode=fast_mode,
        **thinking_kwargs,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="brainstorming_agent"):
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text
                        print(block.text, end="", flush=True)

    print()
    logger.info("Brainstorming agent completed, output length=%d", len(response_text))
    return response_text
