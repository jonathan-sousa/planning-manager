"""Lambda entry point for the planning solver."""

import os
import platform
from importlib.metadata import version

import aurora_dsql_psycopg as dsql
from ortools.sat.python import cp_model

from . import db, model


def check_database() -> str:
    with (
        dsql.connect(host=os.environ["DATABASE_ENDPOINT"], user="admin") as conn,
        conn.cursor() as cur,
    ):
        cur.execute("SELECT 1")
        cur.fetchone()
    return "ok"


def health() -> dict:
    model = cp_model.CpModel()
    x = model.new_bool_var("x")
    model.add(x == 1)
    solver = cp_model.CpSolver()
    status = solver.solve(model)
    return {
        "status": solver.status_name(status),
        "ortoolsVersion": version("ortools"),
        "pythonVersion": platform.python_version(),
        "database": check_database(),
    }


def solve_run(run_id: str) -> None:
    """Solves a run's month and stores the proposal (or the error) in the run."""
    with db.connect() as conn:
        run = db.start_run(conn, run_id)
        if run is None:  # already handled (duplicate invocation)
            return
        try:
            problem = db.load_problem(conn, run["month"], run["mode"])
            db.finish_run(conn, run_id, result=model.solve(problem))
        except Exception as error:  # the run must never stay RUNNING
            db.finish_run(conn, run_id, error=f"{type(error).__name__}: {error}")
            raise


def handler(event, context):
    action = event.get("action")
    if action == "health":
        return health()
    if action == "solve":
        return solve_run(event["runId"])
    raise ValueError(f"Unknown action: {action!r}")
