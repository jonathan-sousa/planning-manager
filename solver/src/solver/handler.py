"""Lambda entry point for the planning solver."""

import platform
from importlib.metadata import version

from ortools.sat.python import cp_model

from . import db, model


def check_database() -> str:
    with db.connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")
        cur.fetchone()
    return "ok"


def health() -> dict:
    probe = cp_model.CpModel()
    x = probe.new_bool_var("x")
    probe.add(x == 1)
    solver = cp_model.CpSolver()
    status = solver.solve(probe)
    return {
        "status": solver.status_name(status),
        "ortoolsVersion": version("ortools"),
        "pythonVersion": platform.python_version(),
        "database": check_database(),
    }


# Seconds kept for loading the month, building the model and writing the result.
OVERHEAD_SECONDS = 25


def solve_run(run_id: str, seconds_left: float | None = None) -> None:
    """Solves a run's month and stores the proposal (or the error) in the run."""
    with db.connect() as conn:
        run = db.start_run(conn, run_id)
        if run is None:  # already handled (duplicate invocation)
            return
        try:
            problem = db.load_problem(conn, run["month"], run["mode"])
            if seconds_left is not None:
                problem.time_limit = min(
                    problem.time_limit, max(10.0, seconds_left - OVERHEAD_SECONDS)
                )
            db.finish_run(conn, run_id, result=model.solve(problem))
        except Exception as error:  # the run must never stay RUNNING
            conn.rollback()  # a failed statement aborts the transaction
            message = (
                str(error)
                if isinstance(error, model.SolveError)
                else "Le calcul a échoué : réessayez (détail dans les journaux du solveur)."
            )
            db.finish_run(conn, run_id, error=message)
            raise


def handler(event, context):
    action = event.get("action")
    if action == "health":
        return health()
    if action == "solve":
        return solve_run(event["runId"], context.get_remaining_time_in_millis() / 1000)
    raise ValueError(f"Unknown action: {action!r}")
