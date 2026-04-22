#!/usr/bin/env python3
"""
Executor runner — runs all pending subtasks in a single agent session.

Delegates to the existing autonomous agent (agents/coder.py) which was already
refactored to run all subtasks in one session.

Input: CLI args --spec <spec_dir> --project <project_dir>
Output: Phase events via stdout (same as existing coder)
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.coder import run_autonomous_agent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, help="Spec directory path")
    parser.add_argument("--project", required=True, help="Project directory path")
    parser.add_argument("--model", required=True, help="Claude model to use")
    parser.add_argument("--max-iterations", type=int, default=None, help="Maximum number of iterations")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("--source-spec-dir", default=None, help="Original spec directory in main project (for syncing from worktree)")
    args = parser.parse_args()

    asyncio.run(run_autonomous_agent(
        project_dir=Path(args.project),
        spec_dir=Path(args.spec),
        model=args.model,
        max_iterations=args.max_iterations,
        verbose=args.verbose,
        source_spec_dir=Path(args.source_spec_dir) if args.source_spec_dir else None,
    ))


if __name__ == "__main__":
    main()
