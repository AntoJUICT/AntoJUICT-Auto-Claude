#!/usr/bin/env python3
"""
Finisher runner — runs tests, creates PR, or merges based on user choice.

Input (stdin JSON): {
    "action": "test" | "pr" | "merge",
    "spec_dir": str,
    "project_dir": str,
    "pr_title": str | null
}
Output (stdout JSON lines): {"status": str, "message": str, "data": dict | null}
"""
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def emit(status: str, message: str, data: dict | None = None) -> None:
    print(json.dumps({"status": status, "message": message, "data": data or {}}, ensure_ascii=False), flush=True)


def run_tests(project_dir: str) -> bool:
    """Run project tests and return success."""
    project_path = Path(project_dir)

    # Try npm test first (frontend)
    if (project_path / "package.json").exists():
        result = subprocess.run(
            ["npm", "test", "--", "--run"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
        emit("test_output", result.stdout + result.stderr)
        return result.returncode == 0

    # Try pytest (backend)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/", "-v", "--tb=short"],
        cwd=project_dir,
        capture_output=True,
        text=True,
        timeout=120,
    )
    emit("test_output", result.stdout + result.stderr)
    return result.returncode == 0


def create_pr(spec_dir: str, project_dir: str, pr_title: str | None) -> dict:
    """Create a GitHub PR from the current branch."""
    spec_path = Path(spec_dir)
    title = pr_title or spec_path.name

    # Get current branch
    branch_result = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    branch = branch_result.stdout.strip()

    # Push branch
    subprocess.run(["git", "push", "-u", "origin", branch], cwd=project_dir, check=True)

    # Create PR
    result = subprocess.run(
        ["gh", "pr", "create", "--title", title, "--fill"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    pr_url = result.stdout.strip()
    return {"pr_url": pr_url, "branch": branch}


def merge_branch(project_dir: str) -> bool:
    """Merge current worktree branch to main."""
    result = subprocess.run(
        ["git", "checkout", "main"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return False
    result = subprocess.run(
        ["git", "merge", "--no-ff", "-"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main() -> None:
    data = json.loads(sys.stdin.read())
    action = data.get("action", "pr")
    spec_dir = data.get("spec_dir", ".")
    project_dir = data.get("project_dir", ".")
    pr_title = data.get("pr_title")

    if action == "test":
        emit("running", "Tests worden uitgevoerd...")
        success = run_tests(project_dir)
        if success:
            emit("complete", "Alle tests geslaagd", {"success": True})
        else:
            emit("error", "Tests gefaald", {"success": False})

    elif action == "pr":
        emit("running", "Pull Request wordt aangemaakt...")
        try:
            result = create_pr(spec_dir, project_dir, pr_title)
            emit("complete", f"PR aangemaakt: {result['pr_url']}", result)
        except Exception as e:
            emit("error", f"PR aanmaken mislukt: {e}")

    elif action == "merge":
        emit("running", "Branch wordt gemerged naar main...")
        success = merge_branch(project_dir)
        if success:
            emit("complete", "Gemerged naar main")
        else:
            emit("error", "Merge mislukt — los conflicten handmatig op")

    else:
        emit("error", f"Onbekende actie: {action}")


if __name__ == "__main__":
    main()
