from pathlib import Path

KANBAN_SKILLS = [
    "writing-plans",
    "executing-plans",
    "subagent-driven-development",
    "test-driven-development",
    "verification-before-completion",
    "requesting-code-review",
    "receiving-code-review",
    "systematic-debugging",
]


class SuperpowersNotInstalledError(RuntimeError):
    pass


def verify_superpowers_installed() -> None:
    """Raise SuperpowersNotInstalledError if any required superpowers skill is missing.

    Checks ~/.claude/skills/<skill>/SKILL.md for each KANBAN_SKILLS entry.
    """
    skills_root = Path.home() / ".claude" / "skills"
    missing = [
        skill
        for skill in KANBAN_SKILLS
        if not (skills_root / skill / "SKILL.md").exists()
    ]
    if missing:
        raise SuperpowersNotInstalledError(
            f"Required superpowers skills not found: {', '.join(missing)}\n"
            f"Install with: /plugin install superpowers@claude-plugins-official\n"
            f"Skills checked in: {skills_root}"
        )
