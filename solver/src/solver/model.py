"""CP-SAT model of a monthly planning.

The hard rules mirror shared/rules/validate.ts (docs/scheduling-rules.md). Each
hard rule instance gets a violation indicator instead of being imposed, and
the objective is lexicographic:

1. as few hard violations as possible (zero unless fixed cells force some);
2. as little coverage shortfall as possible;
3. the weighted soft terms (hours, wishes, fairness, isolated rest, stability).

The model works on literals: a cell is either fixed (a constant) or free (one
boolean per assignable work shift, none set meaning a rest day).
"""

from dataclasses import dataclass, field
from typing import Any, Self

from ortools.sat.python import cp_model

from .calendar import (
    add_days,
    counted_on,
    day_kind,
    day_of_week,
    days_between,
    fortnight_start,
    is_public_holiday,
    month_dates,
    nominal_minutes,
    paris_minute,
    shift_interval,
)
from .literals import Lit, any_of, as_expr, both, negate, none_of

CONTEXT_DAYS = 13
ANNUAL_MINUTES = {
    "STANDARD_1607": 1607 * 60,
    "VARIABLE_REST_1582": 1582 * 60,
    "NIGHT_1476": 1476 * 60,
}
TARGET_GAP_WEIGHT = 1
"""Weight of a person missing to reach a need's target (below the minimum is level 2)."""


class SolveError(Exception):
    """A failure whose message (French) is shown to the manager."""


@dataclass
class Problem:
    month: str
    mode: str  # COMPLETE | REOPTIMIZE
    settings: dict
    agents: list[dict]
    shift_types: list[dict]
    cells: list[dict]  # existing cells, month and context
    needs: list[dict]
    overrides: list[dict]
    requests: list[dict]
    time_limit: float = 60.0

    @classmethod
    def from_json(cls, data: dict) -> Self:
        return cls(
            month=data["month"],
            mode=data.get("mode", "COMPLETE"),
            settings=data["settings"],
            agents=data["agents"],
            shift_types=data["shiftTypes"],
            cells=data["cells"],
            needs=data.get("needs", []),
            overrides=data.get("overrides", []),
            requests=data.get("requests", []),
            time_limit=float(data.get("timeLimitSeconds", 60)),
        )


@dataclass
class Slot:
    """What an agent does on a day: a fixed shift id (or None), or free choices."""

    fixed: str | None = None
    choices: dict[str, Any] = field(default_factory=dict)  # shift id -> bool var

    @property
    def free(self) -> bool:
        return bool(self.choices)


class PlanningModel:
    def __init__(self, problem: Problem, frozen: bool = False):
        """`frozen` keeps every cell as it is (empty ones stay empty): the model
        then only counts the violations of the given grid."""
        self.p = problem
        self.frozen = frozen
        self.m = cp_model.CpModel()
        self.settings = problem.settings
        self.dates = month_dates(problem.month)
        first, last = self.dates[0], self.dates[-1]
        self.window = [
            add_days(first, i)
            for i in range(-CONTEXT_DAYS, len(self.dates) + CONTEXT_DAYS)
        ]
        self.shifts = {shift["id"]: shift for shift in problem.shift_types}
        self.work_shifts = [
            shift
            for shift in problem.shift_types
            if shift["kind"] == "WORK"
            and not shift.get("archived")
            and shift["startTime"]
            and self._well_defined(shift)
        ]
        self.hard: list[Any] = []  # violation indicators (bool vars)
        self.hard_constant = 0  # violations already fixed by constant cells
        self.slots: dict[tuple[str, str], Slot] = {}
        self._off: dict[tuple[str, str], Lit] = {}
        self._rest: dict[tuple[str, str], Lit] = {}
        self.absences = absences_of(problem.requests)
        self._build_slots(first, last)

    def _well_defined(self, shift: dict) -> bool:
        """Within the maximum amplitude, with the break its length requires."""
        s = self.settings
        span = nominal_minutes(shift["startTime"], shift["endTime"])
        needs_break = span - shift["breakMinutes"] > s["breakThresholdMinutes"]
        return span <= s["maxShiftAmplitudeMinutes"] and not (
            needs_break and shift["breakMinutes"] < s["minBreakMinutes"]
        )

    # --- cells ------------------------------------------------------------

    def _build_slots(self, first: str, last: str) -> None:
        existing = {(c["agentId"], c["date"]): c for c in self.p.cells}
        absences = self.absences

        for agent in self.p.agents:
            for day in self.window:
                key = (agent["id"], day)
                cell = existing.get(key)
                in_month = first <= day <= last
                # Outside the month or the contract, or a frozen grid: as it is.
                if not in_month or not in_contract(agent, day) or self.frozen:
                    self.slots[key] = Slot(fixed=cell["shiftTypeId"] if cell else None)
                    continue
                if cell and (self.p.mode == "COMPLETE" or cell.get("locked")):
                    self.slots[key] = Slot(fixed=cell["shiftTypeId"])
                    continue
                if key in absences:
                    # An approved absence holds its code, placed if missing (an
                    # archived code cannot be written: the cell stays as it is).
                    archived = self.shifts.get(absences[key], {}).get("archived")
                    current = cell["shiftTypeId"] if cell else None
                    self.slots[key] = Slot(fixed=current if archived else absences[key])
                    continue
                if (
                    cell
                    and self.shifts.get(cell["shiftTypeId"], {}).get("kind") != "WORK"
                ):
                    self.slots[key] = Slot(fixed=cell["shiftTypeId"])
                    continue
                choices = {}
                for shift in self.work_shifts:
                    if agent["nightMode"] == "DAY_ONLY" and shift["isNight"]:
                        continue
                    if agent["nightMode"] == "NIGHT_ONLY" and not shift["isNight"]:
                        continue
                    var = self.m.new_bool_var(
                        f"x_{agent['id'][:8]}_{day}_{shift['code']}"
                    )
                    choices[shift["id"]] = var
                self.m.add_at_most_one(choices.values())
                # Start from the current draft (reoptimizing) or an empty cell:
                # every hard rule has a violation indicator, so both are feasible.
                for shift_id, var in choices.items():
                    self.m.add_hint(var, bool(cell) and shift_id == cell["shiftTypeId"])
                self.slots[key] = Slot(choices=choices)

    def assigned(self, agent_id: str, day: str, shift_id: str) -> Lit:
        slot = self.slots.get((agent_id, day))
        if slot is None:
            return False
        if not slot.free:
            return slot.fixed == shift_id
        return slot.choices.get(shift_id, False)

    def options(self, agent_id: str, day: str) -> list[tuple[dict, Lit]]:
        """(work shift, literal) pairs possible on a day."""
        slot = self.slots.get((agent_id, day))
        if slot is None:
            return []
        if not slot.free:
            shift = self.shifts.get(slot.fixed) if slot.fixed else None
            return (
                [(shift, True)]
                if shift and shift["kind"] == "WORK" and shift["startTime"]
                else []
            )
        return [(self.shifts[sid], var) for sid, var in slot.choices.items()]

    def works(self, agent_id: str, day: str) -> Any:
        """1 when a work shift starts that day (expression or constant)."""
        options = self.options(agent_id, day)
        return sum(lit if not isinstance(lit, bool) else int(lit) for _, lit in options)

    def counted(self, agent_id: str, day: str, work_only: bool = False) -> Any:
        """Minutes credited that day; `work_only` leaves absences out (weekly limit)."""
        slot = self.slots.get((agent_id, day))
        if slot is None:
            return 0
        if not slot.free:
            shift = self.shifts.get(slot.fixed) if slot.fixed else None
            if not shift or (work_only and shift["kind"] != "WORK"):
                return 0
            return counted_on(day, shift)
        return sum(
            counted_on(day, self.shifts[sid]) * var for sid, var in slot.choices.items()
        )

    # --- hard rule helpers ---------------------------------------------------

    def clause(self, literals: list[Lit]) -> None:
        """At least one literal true, else one violation."""
        if any(lit is True for lit in literals):
            return
        variables = [lit for lit in literals if lit is not False]
        if not variables:
            self.hard_constant += 1
            return
        violated = self.m.new_bool_var("")
        self.m.add_bool_or([*variables, violated])
        self.hard.append(violated)

    def at_most(self, expression: Any, bound: int, scale: int) -> None:
        """Linear expression ≤ bound, else one violation; `scale` bounds the overshoot."""
        if isinstance(expression, int):
            if expression > bound:
                self.hard_constant += 1
            return
        violated = self.m.new_bool_var("")
        self.m.add(expression <= bound + scale * violated)
        self.hard.append(violated)

    # --- hard rules ------------------------------------------------------------

    def add_hard_rules(self) -> None:
        self._fixed_absences()
        for agent in self.p.agents:
            self._fixed_work_cells(agent)
            self._daily_rest(agent)
            self._rolling_weeks(agent)
            self._fortnights(agent)

    def _fixed_absences(self) -> None:
        """Approved absences hold their code (only a frozen grid can differ)."""
        first, last = self.dates[0], self.dates[-1]
        agents = {agent["id"]: agent for agent in self.p.agents}
        for (agent_id, day), code in self.absences.items():
            slot = self.slots.get((agent_id, day))
            if (
                first <= day <= last
                and slot
                and not slot.free
                and slot.fixed != code
                and in_contract(agents[agent_id], day)
            ):
                self.hard_constant += 1

    def _fixed_work_cells(self, agent: dict) -> None:
        """Fixed work cells: day/night mode, amplitude and break. Free cells
        only offer the shifts allowed to the agent and well defined."""
        for day in self.dates:
            slot = self.slots[(agent["id"], day)]
            shift = (
                self.shifts.get(slot.fixed) if not slot.free and slot.fixed else None
            )
            if not shift or shift["kind"] != "WORK" or not shift["startTime"]:
                continue
            mode = agent["nightMode"]
            self.hard_constant += sum(
                (
                    mode == "DAY_ONLY" and shift["isNight"],
                    mode == "NIGHT_ONLY" and not shift["isNight"],
                    not self._well_defined(shift),
                )
            )

    def _daily_rest(self, agent: dict) -> None:
        """Daily rest between shifts of consecutive days (real time), from the
        last day of the previous month."""
        a = agent["id"]
        for day in [add_days(self.dates[0], -1), *self.dates]:
            for shift1, lit1 in self.options(a, day):
                for shift2, lit2 in self.options(a, add_days(day, 1)):
                    _, end = shift_interval(day, shift1["startTime"], shift1["endTime"])
                    start, _ = shift_interval(
                        add_days(day, 1), shift2["startTime"], shift2["endTime"]
                    )
                    if start - end < self.settings["minDailyRestMinutes"]:
                        self.clause([negate(lit1), negate(lit2)])

    def _rolling_weeks(self, agent: dict) -> None:
        """Every 7 rolling days ending in the month: hours, consecutive days, long rest."""
        s = self.settings
        a = agent["id"]
        for end in self.dates:
            # 48 h over 7 rolling days.
            week = [add_days(end, -i) for i in range(7)]
            self.at_most(
                sum(self.counted(a, d, work_only=True) for d in week),
                s["maxWeeklyMinutes"],
                7 * 24 * 60,
            )
            # Consecutive worked days.
            run = [add_days(end, -i) for i in range(s["maxConsecutiveWorkDays"] + 1)]
            self.at_most(
                sum(self.works(a, d) for d in run), s["maxConsecutiveWorkDays"], 1
            )
            # A long rest meets every 7-day window: one starting after the work of
            # the 8 days before the window's last day, or after that day itself
            # when its work ends before the window does (midnight).
            starts = [self.long_rest_after(a, add_days(end, -i)) for i in range(1, 9)]
            starts.append(
                both(
                    self.m, self.long_rest_after(a, end), negate(self.ends_late(a, end))
                )
            )
            self.clause(starts)

    def _fortnights(self, agent: dict) -> None:
        """Fixed fortnights: rest days, two consecutive with a Sunday."""
        s = self.settings
        a = agent["id"]
        starts = sorted(
            {fortnight_start(d, s["fortnightAnchorDate"]) for d in self.dates}
        )
        for start in starts:
            days = [add_days(start, i) for i in range(14)]
            if not all(in_contract(agent, d) for d in days):
                continue
            rest = {
                d: self.rest_day(a, d)
                for d in [add_days(start, -1), *days, add_days(start, 14)]
            }
            self.at_most(
                sum(1 - as_expr(rest[d]) for d in days),
                14 - s["fortnightMinRestDays"],
                14,
            )
            pairs = []
            for d in days:
                if day_of_week(d) != 0:
                    continue
                for other in (add_days(d, -1), add_days(d, 1)):
                    pairs.append(both(self.m, rest[d], rest[other]))
            self.clause(pairs)

    # --- derived literals ------------------------------------------------------

    def off(self, agent_id: str, day: str) -> Lit:
        """True when no work shift starts that day."""
        key = (agent_id, day)
        if key not in self._off:
            options = self.options(agent_id, day)
            if any(lit is True for _, lit in options):
                self._off[key] = False
            else:
                self._off[key] = none_of(
                    self.m, [lit for _, lit in options if lit is not False]
                )
        return self._off[key]

    def ends_late(self, agent_id: str, day: str) -> Lit:
        """True when the work starting that day ends at or after the next midnight."""
        midnight = paris_minute(add_days(day, 1), "00:00")
        late = [
            lit
            for shift, lit in self.options(agent_id, day)
            if shift_interval(day, shift["startTime"], shift["endTime"])[1] >= midnight
        ]
        if any(lit is True for lit in late):
            return True
        return negate(none_of(self.m, [lit for lit in late if lit is not False]))

    def night_on(self, agent_id: str, day: str) -> Lit:
        nights = [lit for shift, lit in self.options(agent_id, day) if shift["isNight"]]
        if any(lit is True for lit in nights):
            return True
        return negate(none_of(self.m, [lit for lit in nights if lit is not False]))

    def rest_day(self, agent_id: str, day: str) -> Lit:
        """No work shift starts that day, nor (optionally) a night the day before."""
        key = (agent_id, day)
        if key not in self._rest:
            off = self.off(agent_id, day)
            if self.settings["restDayExcludesPreviousNight"]:
                off = both(
                    self.m, off, negate(self.night_on(agent_id, add_days(day, -1)))
                )
            self._rest[key] = off
        return self._rest[key]

    def long_rest_after(self, agent_id: str, day: str) -> Lit:
        """A rest of the weekly minimum starts after the work of `day`: two
        days off after it, or one day off and a compatible shift two days later."""
        off1 = self.off(agent_id, add_days(day, 1))
        off2 = self.off(agent_id, add_days(day, 2))
        three = both(self.m, off1, off2)
        if three is True or off1 is False:
            return three
        # One day off, then shifts far enough apart.
        conflicts = []
        for shift1, lit1 in self.options(agent_id, day):
            for shift2, lit2 in self.options(agent_id, add_days(day, 2)):
                _, end = shift_interval(day, shift1["startTime"], shift1["endTime"])
                start, _ = shift_interval(
                    add_days(day, 2), shift2["startTime"], shift2["endTime"]
                )
                if start - end < self.settings["minWeeklyRestMinutes"]:
                    conflicts.append(both(self.m, lit1, lit2))
        if any(c is True for c in conflicts):
            two = False
        else:
            live = [c for c in conflicts if c is not False]
            two = both(self.m, off1, none_of(self.m, live)) if live else off1
        if two is True or three is True:
            return True
        literals = [lit for lit in (two, three) if lit is not False]
        if not literals:
            return False
        return any_of(self.m, literals)

    # --- coverage and soft terms -----------------------------------------------

    def coverage_terms(self) -> tuple[list[Any], list[Any]]:
        """Shortfall below each minimum, and below each target."""
        agents = {agent["id"]: agent for agent in self.p.agents}
        shortfalls, target_gaps = [], []
        for day in self.dates:
            slots = {}
            for need in self.p.needs:
                if need["dayKind"] == day_kind(day):
                    slots[
                        (need["shiftTypeId"], need["gradeId"], need.get("skillId"))
                    ] = need
            for override in self.p.overrides:
                if override["date"] == day:
                    key = (
                        override["shiftTypeId"],
                        override["gradeId"],
                        override.get("skillId"),
                    )
                    slots[key] = {**slots.get(key, {}), **override, "targetCount": None}
            for (shift_id, grade_id, skill_id), need in slots.items():
                count = sum(
                    as_expr(self.assigned(a, day, shift_id))
                    for a, agent in agents.items()
                    if agent["gradeId"] == grade_id
                    and (not skill_id or skill_id in agent["skillIds"])
                )
                for bound, sink in (
                    (need["minCount"], shortfalls),
                    (need.get("targetCount"), target_gaps),
                ):
                    if not bound:
                        continue
                    gap = self.m.new_int_var(0, bound, "")
                    self.m.add(count + gap >= bound)
                    sink.append(gap)
        return shortfalls, target_gaps

    def soft_terms(self) -> list[Any]:
        s = self.settings
        first, last = self.dates[0], self.dates[-1]
        terms = []
        by_grade: dict[str, list[dict]] = {}
        for agent in self.p.agents:
            by_grade.setdefault(agent["gradeId"], []).append(agent)
            a = agent["id"]
            # Monthly hours: distance to the target beyond the tolerance, in hours.
            credited = sum(self.counted(a, d) for d in self.dates)
            target = self.target_minutes(agent)
            excess = self.m.new_int_var(0, 744 * 60, "")
            self.m.add(excess >= credited - target - s["monthlyHoursToleranceMinutes"])
            self.m.add(excess >= target - credited - s["monthlyHoursToleranceMinutes"])
            hours = self.m.new_int_var(0, 744, "")
            self.m.add_division_equality(hours, excess, 60)
            terms.append(s["hoursDeviationWeight"] * hours)
            # Isolated rest day between two worked days (an absence is not one).
            for day in self.dates:
                slot = self.slots[(a, day)]
                fixed = self.shifts.get(slot.fixed) if slot.fixed else None
                if not in_contract(agent, day) or (fixed and fixed["kind"] != "REST"):
                    continue
                isolated = both(
                    self.m,
                    self.off(a, day),
                    both(
                        self.m,
                        self.worked(a, add_days(day, -1)),
                        self.worked(a, add_days(day, 1)),
                    ),
                )
                if isolated is not False:
                    terms.append(s["isolatedRestDayWeight"] * as_expr(isolated))
        # Wishes.
        for request in self.p.requests:
            day = request["startDate"]
            while day <= request["endDate"]:
                if first <= day <= last and (request["agentId"], day) in self.slots:
                    if request["kind"] == "WISH_OFF":
                        terms.append(
                            s["wishWeight"] * self.works(request["agentId"], day)
                        )
                    elif request["kind"] == "WISH_SHIFT":
                        granted = self.assigned(
                            request["agentId"], day, request["shiftTypeId"]
                        )
                        terms.append(s["wishWeight"] * (1 - as_expr(granted)))
                day = add_days(day, 1)
        # Fairness within each grade: spread between the most and least loaded.
        for agents in by_grade.values():
            for weight, counter in (
                (s["nightFairnessWeight"], self.nights),
                (s["weekendFairnessWeight"], self.weekend_days),
                (s["holidayFairnessWeight"], self.holidays),
            ):
                values = [
                    counter(agent)
                    for agent in agents
                    if agent["nightMode"] == "MIXED" or counter is not self.nights
                ]
                if len(values) < 2 or not weight:
                    continue
                high, low = self.m.new_int_var(0, 31, ""), self.m.new_int_var(0, 31, "")
                for value in values:
                    self.m.add(high >= value)
                    self.m.add(low <= value)
                terms.append(weight * (high - low))
        # Stability: changes from the current draft.
        if self.p.mode == "REOPTIMIZE":
            current = {
                (c["agentId"], c["date"]): c["shiftTypeId"] for c in self.p.cells
            }
            for (a, day), slot in self.slots.items():
                if slot.free and (a, day) in current:
                    kept = slot.choices.get(current[(a, day)], False)
                    terms.append(s["stabilityWeight"] * (1 - as_expr(kept)))
        return terms

    def worked(self, agent_id: str, day: str) -> Lit:
        return negate(self.off(agent_id, day))

    def nights(self, agent: dict) -> Any:
        return sum(
            as_expr(lit)
            for d in self.dates
            for shift, lit in self.options(agent["id"], d)
            if shift["isNight"]
        )

    def weekend_days(self, agent: dict) -> Any:
        return sum(
            self.works(agent["id"], d) for d in self.dates if day_of_week(d) in (0, 6)
        )

    def holidays(self, agent: dict) -> Any:
        return sum(
            self.works(agent["id"], d) for d in self.dates if is_public_holiday(d)
        )

    def target_minutes(self, agent: dict) -> int:
        """Annual obligation × ratio, pro rata of the contract days (mixed regime: 1607 h)."""
        annual = ANNUAL_MINUTES.get(
            agent["hoursRegime"], ANNUAL_MINUTES["STANDARD_1607"]
        )
        days = sum(1 for d in self.dates if in_contract(agent, d))
        year = int(self.p.month[:4])
        year_days = days_between(f"{year}-01-01", f"{year + 1}-01-01")
        return round(annual * agent["workTimeRatio"] / 100 * days / year_days)

    # --- solving ------------------------------------------------------------

    def solve(self) -> dict:
        self.add_hard_rules()
        shortfalls, target_gaps = self.coverage_terms()
        soft = self.soft_terms() + [TARGET_GAP_WEIGHT * gap for gap in target_gaps]
        solver = cp_model.CpSolver()
        solver.parameters.random_seed = 0
        solver.parameters.num_workers = 8
        stats: dict[str, Any] = {"hardFixed": self.hard_constant}
        budget = self.p.time_limit
        levels = [
            ("hard", sum(self.hard)),
            ("coverage", sum(shortfalls)),
            ("soft", sum(soft)),
        ]
        shares = [0.2, 0.3, 0.5]
        chosen: dict[int, bool] | None = None  # by variable index
        for (name, objective), share in zip(levels, shares, strict=True):
            if isinstance(objective, int):
                stats[name] = objective
                continue
            self.m.minimize(objective)
            solver.parameters.max_time_in_seconds = max(1.0, budget * share)
            status = solver.solve(self.m)
            stats[f"{name}Status"] = solver.status_name(status)
            if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                if chosen is None:
                    raise SolveError(
                        "Aucune solution trouvée dans le temps imparti : relancez le calcul."
                    )
                break  # out of time: keep the previous level's solution
            value = round(solver.objective_value)
            stats[name] = value
            chosen = {
                var.index: solver.boolean_value(var) for var in self._all_choice_vars()
            }
            # Keep this level's best value, and start the next level from here.
            self.m.add(objective <= value)
            self.m.clear_hints()
            for var in self._all_choice_vars():
                self.m.add_hint(var, chosen[var.index])
        stats["hard"] = stats.get("hard", 0) + self.hard_constant
        return {"cells": self._changes(chosen or {}), "stats": stats}

    def _all_choice_vars(self):
        for slot in self.slots.values():
            yield from slot.choices.values()

    def _changes(self, values: dict[int, bool]) -> list[dict]:
        """Cells of the month whose content differs from the current draft."""
        current = {(c["agentId"], c["date"]): c["shiftTypeId"] for c in self.p.cells}
        changes = []
        for (agent_id, day), slot in self.slots.items():
            if not self.dates[0] <= day <= self.dates[-1]:
                continue
            if slot.free:
                chosen = next(
                    (sid for sid, var in slot.choices.items() if values.get(var.index)),
                    None,
                )
            else:
                chosen = slot.fixed
            if chosen != current.get((agent_id, day)):
                changes.append(
                    {"agentId": agent_id, "date": day, "shiftTypeId": chosen}
                )
        return changes


def absences_of(requests: list[dict]) -> dict[tuple[str, str], str]:
    """Approved absence code by (agent, day)."""
    absences = {}
    for request in requests:
        if request["kind"] != "ABSENCE_APPROVED":
            continue
        day = request["startDate"]
        while day <= request["endDate"]:
            absences[(request["agentId"], day)] = request["shiftTypeId"]
            day = add_days(day, 1)
    return absences


def in_contract(agent: dict, day: str) -> bool:
    """Mirror of inContract (shared/rules/model.ts)."""
    return day >= agent["startDate"] and (
        not agent.get("endDate") or day <= agent["endDate"]
    )


def solve(problem: Problem) -> dict:
    return PlanningModel(problem).solve()
