"""Deterministic eligibility engine. No LLM anywhere in this file.

    rule      -> pass | fail | unknown      (unknown = profile field is None)
    OR-group  -> pass if any member passes, fail if all fail, else unknown
    scheme    -> not_eligible if any unit fails
                 needs_info   if any unit is unknown
                 eligible     otherwise

A "unit" is either one ungrouped rule or one whole OR-group; units are ANDed.
"""

from __future__ import annotations

import operator
from typing import Any, Iterable

from app.i18n import format_value
from app.models import (
    LocalizedText,
    Op,
    Profile,
    Rule,
    RuleOutcome,
    RuleResult,
    Scheme,
    SchemeResult,
    SchemeStatus,
)

POST_MATRIC_COURSES = ("iti", "diploma", "undergraduate", "postgraduate", "phd")

_ORDER_OPS = {"gt": operator.gt, "gte": operator.ge, "lt": operator.lt, "lte": operator.le}
_STATUS_RANK: dict[SchemeStatus, int] = {"eligible": 0, "needs_info": 1, "not_eligible": 2}


# --------------------------------------------------------------------------- comparison


def _same(a: Any, b: Any) -> bool:
    """Equality that never confuses True with 1 and ignores case/whitespace for strings."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, str) and isinstance(b, str):
        return a.strip().casefold() == b.strip().casefold()
    return a == b


def compare(op: Op, actual: Any, expected: Any) -> bool:
    if op == "eq":
        return _same(actual, expected)
    if op == "ne":
        return not _same(actual, expected)
    if op == "in":
        return any(_same(actual, x) for x in expected)
    if op == "not_in":
        return not any(_same(actual, x) for x in expected)
    if op in _ORDER_OPS:
        if isinstance(actual, bool) or not isinstance(actual, (int, float)):
            raise TypeError(f"'{op}' needs a number, got {actual!r}")
        return _ORDER_OPS[op](actual, expected)
    raise ValueError(f"unsupported operator: {op}")


# --------------------------------------------------------------------------- profile


def normalize_profile(profile: Profile) -> Profile:
    """Fill fields that follow logically from others, so we don't ask redundant questions.

    - not a student                 -> not a post-matric student, not in a final year
    - studying ITI/diploma/degree   -> a post-matric student
    - post-matric student           -> is a student
    - not a farmer                  -> not a small/marginal farmer
    """
    data = profile.model_dump()
    if data["course_level"] in POST_MATRIC_COURSES and data["is_post_matric_student"] is None:
        data["is_post_matric_student"] = True
    if data["is_post_matric_student"] is True and data["is_student"] is None:
        data["is_student"] = True
    if data["is_student"] is False:
        for field in ("is_post_matric_student", "is_final_year"):
            if data[field] is None:
                data[field] = False
    if data["is_farmer"] is False and data["is_small_marginal_farmer"] is None:
        data["is_small_marginal_farmer"] = False
    return Profile(**data)


# --------------------------------------------------------------------------- evaluation


def evaluate_rule(rule: Rule, profile: Profile, default_source_url: str) -> RuleResult:
    actual = getattr(profile, rule.field)
    outcome: RuleOutcome
    if actual is None:
        outcome = "unknown"
    else:
        outcome = "pass" if compare(rule.op, actual, rule.value) else "fail"
    return RuleResult(
        rule_id=rule.id,
        field=rule.field,
        op=rule.op,
        expected=rule.value,
        actual=actual,
        outcome=outcome,
        description=rule.description,
        description_hi=rule.description_hi,
        clause=rule.clause,
        source_url=rule.source_url or default_source_url,
        group=rule.group,
    )


def _units(results: list[RuleResult]) -> list[list[RuleResult]]:
    """Split rule results into AND-units, preserving first-seen order."""
    units: list[list[RuleResult]] = []
    by_group: dict[str, list[RuleResult]] = {}
    for r in results:
        if r.group is None:
            units.append([r])
        elif r.group in by_group:
            by_group[r.group].append(r)
        else:
            by_group[r.group] = [r]
            units.append(by_group[r.group])
    return units


def _unit_outcome(unit: list[RuleResult]) -> RuleOutcome:
    outcomes = [r.outcome for r in unit]
    if "pass" in outcomes:
        return "pass"
    if all(o == "fail" for o in outcomes):
        return "fail"
    return "unknown"


def _reason_for(unit: list[RuleResult]) -> LocalizedText:
    def part(r: RuleResult, lang: str) -> str:
        desc = r.description_hi if lang == "hi" else r.description
        yours = "आपका" if lang == "hi" else "yours"
        return f"{desc} ({yours}: {format_value(r.field, r.actual, lang)})"  # type: ignore[arg-type]

    if len(unit) == 1 and unit[0].group is None:
        return LocalizedText(en=part(unit[0], "en"), hi=part(unit[0], "hi"))
    return LocalizedText(
        en="None of these apply: " + "; ".join(part(r, "en") for r in unit),
        hi="इनमें से कोई शर्त पूरी नहीं होती: " + "; ".join(part(r, "hi") for r in unit),
    )


def evaluate_scheme(scheme: Scheme, profile: Profile) -> SchemeResult:
    profile = normalize_profile(profile)
    results = [evaluate_rule(r, profile, scheme.source_url) for r in scheme.rules]
    units = _units(results)
    outcomes = [_unit_outcome(u) for u in units]

    status: SchemeStatus
    if "fail" in outcomes:
        status = "not_eligible"
    elif "unknown" in outcomes:
        status = "needs_info"
    else:
        status = "eligible"

    missing: list[str] = []
    if status == "needs_info":
        for unit, outcome in zip(units, outcomes):
            if outcome == "unknown":
                for r in unit:
                    if r.outcome == "unknown" and r.field not in missing:
                        missing.append(r.field)

    failed = [_reason_for(u) for u, o in zip(units, outcomes) if o == "fail"]

    return SchemeResult(
        scheme_id=scheme.id,
        name=scheme.name,
        name_hi=scheme.name_hi,
        topics=scheme.topics,
        kind=scheme.kind,
        status=status,
        rule_results=results,
        passed_count=sum(r.outcome == "pass" for r in results),
        total_rules=len(results),
        missing_fields=missing,
        failed_reasons=failed,
        benefit=scheme.benefit,
        documents=scheme.documents,
        notes=scheme.notes,
        source_url=scheme.source_url,
        verified=scheme.verified,
        last_verified=scheme.last_verified,
    )


def evaluate_all(profile: Profile, schemes: Iterable[Scheme]) -> list[SchemeResult]:
    profile = normalize_profile(profile)
    return [evaluate_scheme(s, profile) for s in schemes]


def rank_results(results: list[SchemeResult]) -> list[SchemeResult]:
    """Display order: eligible, then needs_info (most rules already passed first), then not_eligible."""
    return sorted(results, key=lambda r: (_STATUS_RANK[r.status], -r.passed_count))


def missing_fields_across(results: list[SchemeResult]) -> list[str]:
    """Missing fields ranked by how many needs_info schemes they would unblock."""
    counts: dict[str, int] = {}
    order: list[str] = []
    for r in results:
        for f in r.missing_fields:
            if f not in counts:
                order.append(f)
            counts[f] = counts.get(f, 0) + 1
    return sorted(order, key=lambda f: (-counts[f], order.index(f)))
