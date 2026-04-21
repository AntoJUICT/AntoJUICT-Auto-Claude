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

    Checks ~/.claude/skills/<skill>/SKILL.md (standalone install) or
    ~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/<skill>/ (plugin install).
    """
    skills_root = Path.home() / ".claude" / "skills"

    # Collect all skills dirs from the plugin cache (any installed version)
    plugin_cache = Path.home() / ".claude" / "plugins" / "cache" / "claude-plugins-official" / "superpowers"
    plugin_skills_roots: list[Path] = []
    if plugin_cache.exists():
        for version_dir in plugin_cache.iterdir():
            skills_dir = version_dir / "skills"
            if skills_dir.exists():
                plugin_skills_roots.append(skills_dir)

    missing = []
    for skill in KANBAN_SKILLS:
        if (skills_root / skill / "SKILL.md").exists():
            continue
        if any((pr / skill).exists() for pr in plugin_skills_roots):
            continue
        missing.append(skill)

    if missing:
        raise SuperpowersNotInstalledError(
            f"Required superpowers skills not found: {', '.join(missing)}\n"
            f"Install with: /plugin install superpowers@claude-plugins-official\n"
            f"Skills checked in: {skills_root}"
        )
