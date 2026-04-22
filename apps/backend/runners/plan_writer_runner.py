#!/usr/bin/env python3
"""
Plan writer runner — analyzes codebase and writes functional_plan.md + implementation_plan.json.

Input  (stdin JSON):  {"spec_summary": str, "spec_dir": str, "project_dir": str}
Output (stdout JSON): {"status": "writing"|"complete"|"error", "message": str}
         Emits multiple lines during execution.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add backend root to path
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


def load_plan_writer_prompt() -> str:
    prompt_file = Path(__file__).parent.parent / "prompts" / "plan_writer.md"
    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")
    return ""


def emit(status: str, message: str) -> None:
    print(json.dumps({"status": status, "message": message}, ensure_ascii=False), flush=True)


async def run(spec_summary: str, spec_dir: str, project_dir: str) -> None:
    emit("writing", "Codebase wordt geanalyseerd...")

    spec_path = Path(spec_dir)
    project_path = Path(project_dir)

    system_prompt = load_plan_writer_prompt()
    prompt = f"""{system_prompt}

## Feature Summary
{spec_summary}

## Spec Directory
{spec_dir}

## Project Directory
{project_dir}

Explore the codebase, then write functional_plan.md and implementation_plan.json as described above.
"""

    # "planner" is a valid key in AGENT_CONFIGS
    client = create_client(
        project_dir=project_path,
        spec_dir=spec_path,
        model="sonnet",
        agent_type="planner",
        fast_mode=False,
    )

    async with client:
        await client.query(prompt)
        async for msg in safe_receive_messages(client, caller="plan_writer"):
            pass  # Agent writes files directly via tools

    # Verify outputs were created
    functional_plan = spec_path / "functional_plan.md"
    impl_plan = spec_path / "implementation_plan.json"

    if not functional_plan.exists():
        emit("error", "functional_plan.md niet aangemaakt door agent")
        return
    if not impl_plan.exists():
        emit("error", "implementation_plan.json niet aangemaakt door agent")
        return

    emit("complete", "Plan klaar")


if __name__ == "__main__":
    data = json.loads(sys.stdin.read())
    asyncio.run(run(
        spec_summary=data.get("spec_summary", ""),
        spec_dir=data.get("spec_dir", "."),
        project_dir=data.get("project_dir", "."),
    ))
