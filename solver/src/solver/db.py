"""Reads a solve run and its month from Aurora DSQL, writes the outcome back."""

import os
from datetime import date
from uuid import UUID

import aurora_dsql_psycopg as dsql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .calendar import add_days, month_dates
from .model import CONTEXT_DAYS, Problem


def connect():
    return dsql.connect(
        host=os.environ["DATABASE_ENDPOINT"], user="admin", row_factory=dict_row
    )


def _camel(row: dict) -> dict:
    """snake_case columns to the camelCase keys of the API; dates and UUIDs as strings."""
    out = {}
    for key, value in row.items():
        head, *rest = key.split("_")
        out[head + "".join(part.title() for part in rest)] = (
            value.isoformat()
            if isinstance(value, date)
            else str(value)
            if isinstance(value, UUID)
            else value
        )
    return out


def _all(cur, query: str, params: tuple = ()) -> list[dict]:
    cur.execute(query, params)
    return [_camel(row) for row in cur.fetchall()]


def start_run(conn, run_id: str) -> dict | None:
    """Marks a pending run as running; None when it was already taken."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE solve_runs SET status = 'RUNNING', started_at = now(), updated_at = now() "
            "WHERE id = %s AND status = 'PENDING' RETURNING id, month, mode",
            (run_id,),
        )
        row = cur.fetchone()
    conn.commit()
    return row


def load_problem(conn, month: str, mode: str) -> Problem:
    dates = month_dates(month)
    first, last = add_days(dates[0], -CONTEXT_DAYS), add_days(dates[-1], CONTEXT_DAYS)
    with conn.cursor() as cur:
        settings = _all(cur, "SELECT * FROM rule_settings WHERE id = 'default'")[0]
        agents = _all(cur, "SELECT * FROM agents")
        links = _all(cur, "SELECT * FROM agent_skills")
        shifts = _all(cur, "SELECT * FROM shift_types")
        cells = _all(
            cur, "SELECT * FROM assignments WHERE date BETWEEN %s AND %s", (first, last)
        )
        needs = _all(cur, "SELECT * FROM coverage_needs")
        overrides = _all(cur, "SELECT * FROM coverage_overrides")
        requests = _all(cur, "SELECT * FROM agent_requests")
    conn.commit()
    for agent in agents:
        agent["skillIds"] = [
            link["skillId"] for link in links if link["agentId"] == agent["id"]
        ]
    # Same agents as the grid (api/rules/model.ts planningAgents).
    with_cells = {cell["agentId"] for cell in cells if cell["date"].startswith(month)}
    agents = [
        agent
        for agent in agents
        if agent["startDate"] <= dates[-1]
        and (not agent["endDate"] or agent["endDate"] >= dates[0])
        and (agent["active"] or agent["id"] in with_cells)
    ]
    return Problem(
        month=month,
        mode=mode,
        settings=settings,
        agents=agents,
        shift_types=shifts,
        cells=cells,
        needs=needs,
        overrides=overrides,
        requests=requests,
    )


def finish_run(
    conn, run_id: str, result: dict | None = None, error: str | None = None
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE solve_runs SET status = %s, result = %s, error = %s, finished_at = now(), "
            "updated_at = now() WHERE id = %s",
            (
                "SUCCEEDED" if error is None else "FAILED",
                Jsonb(result) if result else None,
                error,
                run_id,
            ),
        )
    conn.commit()
