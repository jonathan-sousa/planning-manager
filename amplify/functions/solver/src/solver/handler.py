"""Lambda entry point for the planning solver."""

import platform
from importlib.metadata import version

from ortools.sat.python import cp_model


def handler(event, context):
    model = cp_model.CpModel()
    x = model.new_bool_var("x")
    model.add(x == 1)
    solver = cp_model.CpSolver()
    status = solver.solve(model)
    return {
        "ortoolsVersion": version("ortools"),
        "pythonVersion": platform.python_version(),
        "status": solver.status_name(status),
    }
