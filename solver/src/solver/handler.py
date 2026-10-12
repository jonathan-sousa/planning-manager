"""Lambda entry point for the planning solver."""

import os
import platform
from importlib.metadata import version

import aurora_dsql_psycopg as dsql
from ortools.sat.python import cp_model


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


def handler(event, context):
    action = event.get("action")
    if action == "health":
        return health()
    raise ValueError(f"Unknown action: {action!r}")
