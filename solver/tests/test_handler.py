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


class FakeConnection:
    def __init__(self):
        self.rolled_back = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def rollback(self):
        self.rolled_back = True


@pytest.fixture
def fake_db(monkeypatch):
    conn = FakeConnection()
    finished = {}
    monkeypatch.setattr(handler.db, "connect", lambda: conn)
    monkeypatch.setattr(
        handler.db,
        "start_run",
        lambda _conn, run_id: {"id": run_id, "month": "2026-11", "mode": "COMPLETE"},
    )
    monkeypatch.setattr(
        handler.db,
        "finish_run",
        lambda _conn, run_id, result=None, error=None: finished.update(
            result=result, error=error
        ),
    )
    return conn, finished


def test_solve_run_stores_the_proposal_within_the_time_left(fake_db, monkeypatch):
    _, finished = fake_db
    problem = handler.model.Problem("2026-11", "COMPLETE", {}, [], [], [], [], [], [])
    monkeypatch.setattr(handler.db, "load_problem", lambda *_: problem)
    monkeypatch.setattr(
        handler.model, "solve", lambda p: {"cells": [], "stats": {"t": p.time_limit}}
    )
    handler.solve_run("run", seconds_left=70)
    assert finished == {"result": {"cells": [], "stats": {"t": 45}}, "error": None}


def test_solve_run_records_a_failure_after_rolling_back(fake_db, monkeypatch):
    conn, finished = fake_db

    def broken(*_):
        raise OSError("connection lost")

    monkeypatch.setattr(handler.db, "load_problem", broken)
    with pytest.raises(OSError):
        handler.solve_run("run")
    assert conn.rolled_back
    assert finished["error"].startswith("Le calcul a échoué")


def test_solve_run_skips_a_run_already_taken(fake_db, monkeypatch):
    _, finished = fake_db
    monkeypatch.setattr(handler.db, "start_run", lambda *_: None)
    handler.solve_run("run")
    assert finished == {}
