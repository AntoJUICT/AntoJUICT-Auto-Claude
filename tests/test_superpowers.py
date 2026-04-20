import pytest
from pathlib import Path
from unittest.mock import patch


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


def test_raises_when_skill_missing(tmp_path):
    """verify_superpowers_installed raises if any SKILL.md is absent."""
    skills_dir = tmp_path / ".claude" / "skills"
    skills_dir.mkdir(parents=True)
    for skill in KANBAN_SKILLS[:-1]:  # alle skills behalve de laatste
        (skills_dir / skill).mkdir()
        (skills_dir / skill / "SKILL.md").write_text("content")

    with patch("core.superpowers.Path.home", return_value=tmp_path):
        from core.superpowers import verify_superpowers_installed, SuperpowersNotInstalledError
        with pytest.raises(SuperpowersNotInstalledError) as exc_info:
            verify_superpowers_installed()
    assert "systematic-debugging" in str(exc_info.value)
    assert "/plugin install" in str(exc_info.value)


def test_passes_when_all_skills_present(tmp_path):
    """verify_superpowers_installed succeeds when all SKILL.md files exist."""
    skills_dir = tmp_path / ".claude" / "skills"
    skills_dir.mkdir(parents=True)
    for skill in KANBAN_SKILLS:
        (skills_dir / skill).mkdir()
        (skills_dir / skill / "SKILL.md").write_text("content")

    with patch("core.superpowers.Path.home", return_value=tmp_path):
        from core.superpowers import verify_superpowers_installed
        verify_superpowers_installed()  # mag niet raisen
