"""Solves a problem (or a list of problems) read as JSON on stdin and prints
the result(s) as JSON.

Used by the end-to-end tests (scripts/solver.*.test.ts) and for debugging:
    uv run --directory solver python -m solver.cli < problem.json
"""

import json
import sys

from .model import Problem, solve


def main() -> None:
    data = json.load(sys.stdin)
    if isinstance(data, list):
        json.dump([solve(Problem.from_json(item)) for item in data], sys.stdout)
    else:
        json.dump(solve(Problem.from_json(data)), sys.stdout)


if __name__ == "__main__":
    main()
