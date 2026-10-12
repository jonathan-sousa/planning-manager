import pytest

from solver import handler


def test_health_solves_trivial_model(monkeypatch):
    monkeypatch.setattr(handler, "check_database", lambda: "skipped")
    result = handler.handler({"action": "health"}, None)
    assert result["status"] == "OPTIMAL"
    assert result["database"] == "skipped"


def test_unknown_action_is_rejected():
    with pytest.raises(ValueError):
        handler.handler({"action": "nope"}, None)
