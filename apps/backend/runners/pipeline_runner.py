"""Superpowers pipeline phase runner.

Entry point for the TypeScript PipelineRunner to execute a single pipeline
phase (brainstorming, planning, or implementation) as a subprocess.

Usage:
    python pipeline_runner.py \\
        --phase brainstorming|planning|implementation \\
        --task-id <id> --spec-id <id> --project-dir <path> \\
        [--task-title <str>] [--task-description <str>] \\
        [--send-back-note <str>] [--model <model-id>]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Add parent directory (apps/backend) to sys.path so core.* imports resolve.
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.phase_event import ExecutionPhase, emit_phase
from core.task_event import TaskEventEmitter

logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

MAX_REVIEW_ITERATIONS = 3


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Superpowers pipeline phase runner")
    parser.add_argument("--phase", required=True, choices=["brainstorming", "planning", "implementation"])
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--spec-id", required=True)
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--task-title", default="")
    parser.add_argument("--task-description", default="")
    parser.add_argument("--send-back-note", default="")
    parser.add_argument("--model", default="")
    return parser.parse_args()


async def _run_brainstorming(
    args: argparse.Namespace,
    project_dir: Path,
    spec_dir: Path,
    emitter: TaskEventEmitter,
) -> None:
    from agents.brainstorming_agent import run as brainstorm
    from agents.model_selector import AgentRole, ModelSelector

    emit_phase(ExecutionPhase.PLANNING, "Brainstorming design spec...")
    model = args.model or ModelSelector().model_for(AgentRole.BRAINSTORMING)

    spec_text = await brainstorm(
        args.task_title,
        args.task_description,
        project_dir=project_dir,
        spec_dir=spec_dir,
        model=model,
    )

    spec_file = spec_dir / "spec.md"
    spec_file.write_text(spec_text, encoding="utf-8")
    logger.info("Brainstorming complete, spec saved (%d chars)", len(spec_text))
    emitter.emit("BRAINSTORMING_COMPLETE", {"specPath": str(spec_file)})


async def _run_planning(
    args: argparse.Namespace,
    project_dir: Path,
    spec_dir: Path,
    emitter: TaskEventEmitter,
) -> None:
    from agents.model_selector import AgentRole, ModelSelector
    from agents.planning_agent import run as plan

    spec_file = spec_dir / "spec.md"
    if not spec_file.exists():
        raise FileNotFoundError(f"spec.md not found at {spec_file} — run brainstorming first")
    design_spec = spec_file.read_text(encoding="utf-8")

    emit_phase(ExecutionPhase.PLANNING, "Creating implementation plan...")
    model = args.model or ModelSelector().model_for(AgentRole.PLANNING)

    plan_dict = await plan(
        design_spec,
        project_dir=project_dir,
        spec_dir=spec_dir,
        model=model,
    )

    plan_file = spec_dir / "implementation_plan.json"
    plan_file.write_text(json.dumps(plan_dict, indent=2, ensure_ascii=False), encoding="utf-8")
    subtask_count = len(plan_dict.get("subtasks", []))
    logger.info("Planning complete, plan saved (%d subtasks)", subtask_count)
    emitter.emit("PLANNING_COMPLETE", {"planPath": str(plan_file), "subtaskCount": subtask_count})


async def _run_implementation(
    args: argparse.Namespace,
    project_dir: Path,
    spec_dir: Path,
    emitter: TaskEventEmitter,
) -> None:
    from agents.final_reviewer_agent import run as final_review
    from agents.implementer_agent import parse_status, run as implement
    from agents.model_selector import AgentRole, ModelSelector
    from agents.quality_reviewer_agent import run as quality_review
    from agents.spec_reviewer_agent import run as spec_review

    spec_file = spec_dir / "spec.md"
    plan_file = spec_dir / "implementation_plan.json"
    if not spec_file.exists():
        raise FileNotFoundError(f"spec.md not found at {spec_file}")
    if not plan_file.exists():
        raise FileNotFoundError(f"implementation_plan.json not found at {plan_file}")

    design_spec = spec_file.read_text(encoding="utf-8")
    plan = json.loads(plan_file.read_text(encoding="utf-8"))
    subtasks: list[dict] = plan.get("subtasks", [])
    total = len(subtasks)
    selector = ModelSelector(override=args.model or None)

    for idx, subtask in enumerate(subtasks):
        file_count = len(subtask.get("files_to_create", [])) + len(subtask.get("files_to_modify", []))
        impl_model = selector.model_for(AgentRole.IMPLEMENTER, file_count=file_count)
        review_model = selector.model_for(AgentRole.SPEC_REVIEWER)
        quality_model = selector.model_for(AgentRole.QUALITY_REVIEWER)

        emit_phase(
            ExecutionPhase.CODING,
            f"Implementing subtask {idx + 1}/{total}",
            progress=int((idx / total) * 100),
            subtask=subtask.get("id", str(idx)),
        )
        emitter.emit("SUBTASK_STARTED", {"subtaskIndex": idx, "total": total, "agentPhase": "implementing"})

        # First subtask may carry a send_back_note from a previous plan_review rejection
        send_back_note: str | None = args.send_back_note if (idx == 0 and args.send_back_note) else None

        for iteration in range(MAX_REVIEW_ITERATIONS):
            impl_output = await implement(
                design_spec, plan, subtask, send_back_note,
                project_dir=project_dir,
                spec_dir=spec_dir,
                model=impl_model,
            )

            impl_status, impl_detail = parse_status(impl_output)
            if impl_status in ("BLOCKED", "NEEDS_CONTEXT"):
                logger.warning(
                    "Implementer returned %s on subtask %s (iteration %d): %s",
                    impl_status, subtask.get("id"), iteration, impl_detail,
                )
                break

            emitter.emit("SUBTASK_STARTED", {"subtaskIndex": idx, "total": total, "agentPhase": "spec_review"})
            spec_passed, spec_issues = await spec_review(
                subtask, impl_output,
                project_dir=project_dir,
                spec_dir=spec_dir,
                model=review_model,
            )
            if not spec_passed:
                send_back_note = "\n".join(spec_issues)
                logger.info("Spec review failed (%d issues) — retrying", len(spec_issues))
                continue

            emitter.emit("SUBTASK_STARTED", {"subtaskIndex": idx, "total": total, "agentPhase": "quality_review"})
            quality_passed, quality_issues = await quality_review(
                subtask, impl_output,
                project_dir=project_dir,
                spec_dir=spec_dir,
                model=quality_model,
            )
            if not quality_passed:
                send_back_note = "\n".join(quality_issues)
                logger.info("Quality review failed (%d issues) — retrying", len(quality_issues))
                continue

            emitter.emit("SUBTASK_STARTED", {"subtaskIndex": idx, "total": total, "agentPhase": "done"})
            break

        emitter.emit("SUBTASK_COMPLETED", {"subtaskIndex": idx, "total": total})

    emit_phase(ExecutionPhase.QA_REVIEW, "Running final review...")
    final_model = selector.model_for(AgentRole.FINAL_REVIEWER)
    final_passed, final_summary = await final_review(
        design_spec, plan,
        project_dir=project_dir,
        spec_dir=spec_dir,
        model=final_model,
    )

    if final_passed:
        emit_phase(ExecutionPhase.COMPLETE, "Implementation complete")
        emitter.emit("ALL_SUBTASKS_DONE", {"summary": final_summary})
    else:
        emit_phase(ExecutionPhase.FAILED, f"Final review failed: {final_summary}")
        emitter.emit("IMPLEMENTATION_FAILED", {"reason": final_summary})


async def main() -> None:
    args = _parse_args()
    project_dir = Path(args.project_dir)
    spec_dir = project_dir / ".juict-agentic-os" / "specs" / args.spec_id
    spec_dir.mkdir(parents=True, exist_ok=True)

    # Write task metadata so TaskEventEmitter can resolve taskId/specId
    metadata_file = spec_dir / "task_metadata.json"
    if not metadata_file.exists():
        metadata_file.write_text(
            json.dumps({"taskId": args.task_id, "specId": args.spec_id}),
            encoding="utf-8",
        )

    emitter = TaskEventEmitter.from_spec_dir(spec_dir)

    try:
        if args.phase == "brainstorming":
            await _run_brainstorming(args, project_dir, spec_dir, emitter)
        elif args.phase == "planning":
            await _run_planning(args, project_dir, spec_dir, emitter)
        elif args.phase == "implementation":
            await _run_implementation(args, project_dir, spec_dir, emitter)
    except Exception as exc:
        logger.error("Pipeline phase %s failed: %s", args.phase, exc, exc_info=True)
        emit_phase(ExecutionPhase.FAILED, str(exc))
        emitter.emit("PIPELINE_ERROR", {"phase": args.phase, "error": str(exc)})
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
