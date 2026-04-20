import pytest
from pathlib import Path
from task_logger.models import TokenUsage


def test_token_usage_dataclass():
    usage = TokenUsage(
        agent_stage="planner",
        input_tokens=1000,
        output_tokens=500,
        cache_creation_input_tokens=100,
        cache_read_input_tokens=50,
    )
    d = usage.to_dict()
    assert d["agent_stage"] == "planner"
    assert d["input_tokens"] == 1000
    assert d["cache_read_input_tokens"] == 50


def test_log_token_usage_writes_jsonl(tmp_path):
    from task_logger.logger import TaskLogger
    from task_logger.models import TokenUsage

    # Maak minimale spec_dir structuur
    spec_dir = tmp_path / "test_spec"
    spec_dir.mkdir()
    (spec_dir / "task_logs.json").write_text('{"phases": {}}')

    logger = TaskLogger(spec_dir, emit_markers=False)
    usage = TokenUsage(agent_stage="coder", input_tokens=200)
    logger.log_token_usage(usage)

    log_file = spec_dir / "token_usage.jsonl"
    assert log_file.exists()
    import json
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    assert len(lines) == 1
    assert lines[0]["agent_stage"] == "coder"
    assert lines[0]["input_tokens"] == 200
