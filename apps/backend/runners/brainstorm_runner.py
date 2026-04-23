#!/usr/bin/env python3
"""
Brainstorm runner — one-shot, takes conversation history, returns next Claude response.

Input  (stdin JSON):  {"messages": [{"role": "user"|"assistant", "content": str}], "project_dir": str, "screen_dir": str | null}
Output (stdout JSON): {"response": str, "ready_to_plan": bool, "spec_summary": str | null, "has_visual": bool}
"""

import asyncio
import json
import re
import sys
from pathlib import Path

# Add auto-claude to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Validate platform-specific dependencies BEFORE any imports that might
# trigger graphiti_core -> real_ladybug -> pywintypes import chain (ACS-253)
from core.dependency_validator import validate_platform_dependencies

validate_platform_dependencies()

# Load .env file with centralized error handling
from cli.utils import import_dotenv

load_dotenv = import_dotenv()

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

from core.client import create_client
from core.error_utils import safe_receive_messages


def load_brainstorm_prompt() -> str:
    prompt_file = Path(__file__).parent.parent / "prompts" / "brainstorm.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    return (
        "Ask ONE question at a time to understand what the user wants to build. "
        "When ready, respond with READY: true\nSUMMARY:\n<summary>"
    )


def build_messages(history: list[dict]) -> str:
    """Format conversation history as a single prompt string."""
    system = load_brainstorm_prompt()
    lines = [system, ""]
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        prefix = "User:" if role == "user" else "Assistant:"
        lines.append(f"{prefix} {content}")
    lines.append("Assistant:")
    return "\n".join(lines)


async def run(messages: list[dict], project_dir: str, screen_dir=None) -> dict:
    prompt = build_messages(messages)
    project_path = Path(project_dir)
    client = create_client(
        project_dir=project_path,
        spec_dir=project_path,
        model="sonnet",
        agent_type="brainstorming",
        fast_mode=True,
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="brainstorm"):
            if type(msg).__name__ == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text

    # Parse and extract VISUAL_SCREEN markers
    visual_pattern = re.compile(
        r'<VISUAL_SCREEN\s+filename="([^"]+)">(.*?)</VISUAL_SCREEN>',
        re.DOTALL,
    )
    matches = visual_pattern.findall(response_text)

    has_visual = False
    if matches and screen_dir:
        content_dir = Path(screen_dir) / "content"
        content_dir.mkdir(parents=True, exist_ok=True)
        for filename, html_content in matches:
            # Use basename only to prevent path traversal
            safe_name = Path(filename).name
            (content_dir / safe_name).write_text(html_content, encoding="utf-8")
        has_visual = True

    # Strip all VISUAL_SCREEN blocks from the response regardless of screen_dir
    response_text = visual_pattern.sub("", response_text)

    ready = "READY: true" in response_text
    spec_summary = None
    if ready and "SUMMARY:" in response_text:
        spec_summary = response_text.split("SUMMARY:", 1)[1].strip()
        response_text = response_text.split("READY: true")[0].strip()

    return {
        "response": (
            "Super, ik heb genoeg informatie. Ik ga nu het plan schrijven."
            if ready
            else response_text.strip()
        ),
        "ready_to_plan": ready,
        "spec_summary": spec_summary,
        "has_visual": has_visual,
    }


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    messages = data.get("messages", [])
    project_dir = data.get("project_dir", ".")
    screen_dir = data.get("screen_dir")
    result = asyncio.run(run(messages, project_dir, screen_dir))
    print(json.dumps(result, ensure_ascii=False))
