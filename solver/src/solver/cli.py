"""Solves a problem read as JSON on stdin and prints the result as JSON.

Used by the end-to-end test (scripts/solver.e2e.test.ts) and for debugging:
    uv run --directory solver python -m solver.cli < problem.json
"""

import json
import sys

from .model import Problem, solve


def main() -> None:
    problem = Problem.from_json(json.load(sys.stdin))
    json.dump(solve(problem), sys.stdout)


if __name__ == "__main__":
    main()
