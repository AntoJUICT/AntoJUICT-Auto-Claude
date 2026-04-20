import pytest
from unittest.mock import patch

def _setup_superpowers(tmp_path):
    from core.superpowers import KANBAN_SKILLS
    skills_dir = tmp_path / ".claude" / "skills"
    for skill in KANBAN_SKILLS:
        (skills_dir / skill).mkdir(parents=True)
        (skills_dir / skill / "SKILL.md").write_text("x")

def test_system_prompt_set_for_kanban_agent(tmp_path, monkeypatch):
    _setup_superpowers(tmp_path)
    monkeypatch.setattr("core.superpowers.Path.home", lambda: tmp_path)
    captured = {}
    class FakeClient:
        def __init__(self, options): captured["options"] = options
    with patch("core.client.ClaudeSDKClient", FakeClient):
        with patch("core.client.get_allowed_tools", return_value=[]):
            with patch("core.client.get_required_mcp_servers", return_value=[]):
                with patch("core.client.load_project_mcp_config", return_value={}):
                    with patch("core.client._get_cached_project_data", return_value=(None, {})):
                        from core.client import create_client
                        create_client(project_dir=tmp_path, spec_dir=tmp_path,
                                      model="claude-sonnet-4-6", agent_type="planner")
    opts = captured["options"]
    sp = getattr(opts, "system_prompt", None)
    sys = getattr(opts, "system", None)
    assert sp is not None or sys is not None
    if sys and isinstance(sys, list):
        assert any(b.get("cache_control") == {"type":"ephemeral"} for b in sys if isinstance(b, dict))
