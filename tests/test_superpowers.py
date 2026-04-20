import pytest
from unittest.mock import patch
from core.superpowers import (
    KANBAN_SKILLS,
    SuperpowersNotInstalledError,
    verify_superpowers_installed,
)


def _make_skills_dir(tmp_path, skills):
    skills_dir = tmp_path / ".claude" / "skills"
    skills_dir.mkdir(parents=True)
    for skill in skills:
        (skills_dir / skill).mkdir()
        (skills_dir / skill / "SKILL.md").write_text("content")


def test_raises_when_skill_missing(tmp_path):
    """verify_superpowers_installed raises if any SKILL.md is absent."""
    _make_skills_dir(tmp_path, KANBAN_SKILLS[:-1])  # alle behalve de laatste

    with patch("core.superpowers.Path.home", return_value=tmp_path):
        with pytest.raises(SuperpowersNotInstalledError) as exc_info:
            verify_superpowers_installed()
    assert "systematic-debugging" in str(exc_info.value)
    assert "/plugin install" in str(exc_info.value)


def test_raises_with_multiple_missing_skills(tmp_path):
    """Alle ontbrekende skills worden samen gerapporteerd."""
    _make_skills_dir(tmp_path, KANBAN_SKILLS[:1])  # alleen de eerste aanwezig

    with patch("core.superpowers.Path.home", return_value=tmp_path):
        with pytest.raises(SuperpowersNotInstalledError) as exc_info:
            verify_superpowers_installed()
    msg = str(exc_info.value)
    for missing in KANBAN_SKILLS[1:]:
        assert missing in msg


def test_passes_when_all_skills_present(tmp_path):
    """verify_superpowers_installed slaagt als alle SKILL.md bestanden aanwezig zijn."""
    _make_skills_dir(tmp_path, KANBAN_SKILLS)

    with patch("core.superpowers.Path.home", return_value=tmp_path):
        verify_superpowers_installed()  # mag niet raisen
