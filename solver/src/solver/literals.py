"""Boolean algebra on CP-SAT literals that may also be Python constants.

A cell the manager fixed makes some literals known in advance (True or
False): these helpers fold the constants instead of creating variables.
"""

from typing import Any

from ortools.sat.python import cp_model

Lit = Any  # a CP-SAT literal, or the constants True / False


def negate(lit: Lit) -> Lit:
    if isinstance(lit, bool):
        return not lit
    return lit.Not()


def as_expr(lit: Lit) -> Any:
    """A literal in a linear expression: 0 or 1 for a constant."""
    return int(lit) if isinstance(lit, bool) else lit


def both(m: cp_model.CpModel, lit1: Lit, lit2: Lit) -> Lit:
    """True when both literals are."""
    if lit1 is False or lit2 is False:
        return False
    if lit1 is True:
        return lit2
    if lit2 is True:
        return lit1
    var = m.new_bool_var("")
    m.add_bool_and([lit1, lit2]).only_enforce_if(var)
    m.add_bool_or([lit1.Not(), lit2.Not()]).only_enforce_if(var.Not())
    return var


def none_of(m: cp_model.CpModel, literals: list[Any]) -> Lit:
    """True when none of the literals (variables, no constant) is."""
    if not literals:
        return True
    var = m.new_bool_var("")
    m.add(sum(literals) == 0).only_enforce_if(var)
    m.add(sum(literals) >= 1).only_enforce_if(var.Not())
    return var


def any_of(m: cp_model.CpModel, literals: list[Lit]) -> Lit:
    """True when at least one of the literals is."""
    if any(lit is True for lit in literals):
        return True
    live = [lit for lit in literals if lit is not False]
    if not live:
        return False
    if len(live) == 1:
        return live[0]
    var = m.new_bool_var("")
    m.add_bool_or(live).only_enforce_if(var)
    m.add_bool_and([lit.Not() for lit in live]).only_enforce_if(var.Not())
    return var
