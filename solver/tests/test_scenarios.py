"""Shared scenarios of fixtures/rule-scenarios/: the CP-SAT model, every cell
fixed as in the scenario, must find a hard violation exactly when the
TypeScript validator does (the `hard` flag, checked by Vitest)."""

import json
from pathlib import Path

import pytest
from solver.model import PlanningModel, Problem

FIXTURES = Path(__file__).parents[2] / "fixtures" / "rule-scenarios"
SHIFTS = [
    {**shift, "id": shift["code"]}
    for shift in json.loads((FIXTURES / "_shifts.json").read_text())
]
SETTINGS = json.loads((FIXTURES / "_settings.json").read_text())
SCENARIOS = sorted(p for p in FIXTURES.glob("*.json") if not p.name.startswith("_"))


def to_problem(scenario: dict) -> Problem:
    counted = {shift["code"]: shift["countedMinutes"] for shift in SHIFTS}
    return Problem.from_json(
        {
            "month": scenario["month"],
            "settings": {**SETTINGS, **scenario.get("settings", {})},
            "shiftTypes": SHIFTS,
            "agents": [
                {
                    "id": agent["name"],
                    "gradeId": agent.get("grade", "IDE"),
                    "skillIds": agent.get("skills", []),
                    "workTimeRatio": 100,
                    "nightMode": agent.get("nightMode", "MIXED"),
                    "hoursRegime": "MIXED_PRORATA",
                    "startDate": agent.get("startDate", "2020-01-01"),
                    "endDate": agent.get("endDate"),
                }
                for agent in scenario["agents"]
            ],
            "cells": [
                {
                    "agentId": name,
                    "date": day,
                    "shiftTypeId": code,
                    "countedMinutes": counted[code],
                    "locked": False,
                }
                for name, days in scenario["cells"].items()
                for day, code in days.items()
            ],
            "needs": [
                {
                    "shiftTypeId": n["shift"],
                    "gradeId": n["grade"],
                    "skillId": n.get("skill"),
                    "dayKind": n["dayKind"],
                    "minCount": n["minCount"],
                }
                for n in scenario.get("needs", [])
            ],
            "overrides": [
                {
                    "date": o["date"],
                    "shiftTypeId": o["shift"],
                    "gradeId": o["grade"],
                    "skillId": o.get("skill"),
                    "minCount": o["minCount"],
                }
                for o in scenario.get("overrides", [])
            ],
            "requests": [
                {
                    "agentId": r["agent"],
                    "startDate": r["startDate"],
                    "endDate": r["endDate"],
                    "kind": r["kind"],
                    "shiftTypeId": r.get("shift"),
                }
                for r in scenario.get("requests", [])
            ],
            "timeLimitSeconds": 5,
        }
    )


@pytest.mark.parametrize("path", SCENARIOS, ids=lambda p: p.stem)
def test_model_agrees_with_the_validator(path):
    scenario = json.loads(path.read_text())
    stats = PlanningModel(to_problem(scenario), frozen=True).solve()["stats"]
    assert (stats["hard"] > 0) == scenario["hard"], scenario["description"]
