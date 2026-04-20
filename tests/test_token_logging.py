import json
import pytest
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


def test_token_usage_default_values():
    usage = TokenUsage(agent_stage="coder")
    d = usage.to_dict()
    assert d["input_tokens"] == 0
    assert d["output_tokens"] == 0
    assert d["cache_creation_input_tokens"] == 0
    assert d["cache_read_input_tokens"] == 0


def _make_logger(tmp_path):
    from task_logger.logger import TaskLogger
    spec_dir = tmp_path / "test_spec"
    spec_dir.mkdir()
    (spec_dir / "task_logs.json").write_text('{"phases": {}}')
    return TaskLogger(spec_dir, emit_markers=False), spec_dir


def test_log_token_usage_writes_jsonl(tmp_path):
    logger, spec_dir = _make_logger(tmp_path)
    usage = TokenUsage(agent_stage="coder", input_tokens=200)
    logger.log_token_usage(usage)

    log_file = spec_dir / "token_usage.jsonl"
    assert log_file.exists()
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    assert len(lines) == 1
    assert lines[0]["agent_stage"] == "coder"
    assert lines[0]["input_tokens"] == 200
    assert "timestamp" in lines[0]


def test_log_token_usage_appends_multiple(tmp_path):
    logger, spec_dir = _make_logger(tmp_path)
    logger.log_token_usage(TokenUsage(agent_stage="planner", input_tokens=100))
    logger.log_token_usage(TokenUsage(agent_stage="coder", input_tokens=200))

    log_file = spec_dir / "token_usage.jsonl"
    lines = [json.loads(l) for l in log_file.read_text().strip().split("\n")]
    assert len(lines) == 2
    assert lines[0]["agent_stage"] == "planner"
    assert lines[1]["agent_stage"] == "coder"
