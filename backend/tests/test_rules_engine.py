"""Unit tests for the deterministic rules engine, using small synthetic schemes."""

from __future__ import annotations

import pytest

from app.models import Profile, Scheme
from app.services.rules_engine import (
    compare,
    evaluate_all,
    evaluate_scheme,
    missing_fields_across,
    normalize_profile,
    rank_results,
)

SRC = "https://example.gov.in/scheme"


def rule(id, field, op, value, group=None, **extra):
    r = {
        "id": id,
        "field": field,
        "op": op,
        "value": value,
        "description": f"{field} {op} {value}",
        "description_hi": f"{field} शर्त",
        "clause": f"Clause {id}",
    }
    if group:
        r["group"] = group
    r.update(extra)
    return r


def scheme(rules, id="test"):
    return Scheme(
        id=id,
        name="Test Scheme",
        name_hi="परीक्षण योजना",
        ministry="Test Ministry",
        topics=["students"],
        kind="scholarship",
        benefit={"en": "Benefit", "hi": "लाभ"},
        documents=[{"en": "Doc", "hi": "दस्तावेज़"}],
        source_url=SRC,
        rules=rules,
    )


# ------------------------------------------------------------------ operators


@pytest.mark.parametrize(
    "op,actual,expected,result",
    [
        ("eq", 5, 5, True),
        ("eq", 5, 6, False),
        ("ne", 5, 6, True),
        ("gt", 61, 60, True),
        ("gt", 60, 60, False),
        ("gte", 60, 60, True),
        ("lt", 17, 18, True),
        ("lte", 40, 40, True),
        ("lte", 41, 40, False),
        ("in", "sc", ["sc", "st"], True),
        ("in", "obc", ["sc", "st"], False),
        ("not_in", "general", ["sc", "st"], True),
        ("not_in", "st", ["sc", "st"], False),
        ("eq", "Uttar Pradesh", "uttar pradesh ", True),  # case/space-insensitive strings
        ("eq", True, 1, False),  # bool never equals int
        ("in", 1, [True], False),
    ],
)
def test_compare(op, actual, expected, result):
    assert compare(op, actual, expected) is result


def test_compare_order_op_rejects_bool():
    with pytest.raises(TypeError):
        compare("gt", True, 0)


# ------------------------------------------------------------------ AND semantics


def test_all_pass_is_eligible():
    s = scheme([rule("a", "age", "gte", 60), rule("b", "is_bpl", "eq", True)])
    r = evaluate_scheme(s, Profile(age=65, is_bpl=True))
    assert r.status == "eligible"
    assert r.passed_count == 2 and r.total_rules == 2
    assert r.missing_fields == [] and r.failed_reasons == []


def test_unknown_field_gives_needs_info():
    s = scheme([rule("a", "age", "gte", 60), rule("b", "is_bpl", "eq", True)])
    r = evaluate_scheme(s, Profile(age=65))
    assert r.status == "needs_info"
    assert r.missing_fields == ["is_bpl"]
    assert [x.outcome for x in r.rule_results] == ["pass", "unknown"]


def test_fail_beats_unknown():
    s = scheme([rule("a", "age", "gte", 60), rule("b", "is_bpl", "eq", True)])
    r = evaluate_scheme(s, Profile(age=40))
    assert r.status == "not_eligible"
    assert r.missing_fields == []  # no point asking when it already fails
    assert len(r.failed_reasons) == 1


# ------------------------------------------------------------------ OR groups


GROUPED = [
    rule("bpl", "is_bpl", "eq", True, group="basis"),
    rule("old", "age", "gte", 70, group="basis"),
    rule("adult", "age", "gte", 18),
]


@pytest.mark.parametrize(
    "profile,status",
    [
        ({"is_bpl": True, "age": 30}, "eligible"),  # first member passes
        ({"is_bpl": False, "age": 75}, "eligible"),  # second member passes
        ({"age": 75}, "eligible"),  # one pass is enough even if the other is unknown
        ({"is_bpl": False, "age": 50}, "not_eligible"),  # all members fail
        ({"age": 50}, "needs_info"),  # one fail + one unknown -> unknown
        ({}, "needs_info"),
    ],
)
def test_or_group(profile, status):
    assert evaluate_scheme(scheme(GROUPED), Profile(**profile)).status == status


def test_or_group_missing_fields_only_lists_unknown_members():
    r = evaluate_scheme(scheme(GROUPED), Profile(age=50))
    assert r.missing_fields == ["is_bpl"]


def test_or_group_failure_reason_lists_all_members_bilingual():
    r = evaluate_scheme(scheme(GROUPED), Profile(is_bpl=False, age=50))
    [reason] = r.failed_reasons
    assert reason.en.startswith("None of these apply:")
    assert "(yours: No)" in reason.en and "(yours: 50 years)" in reason.en
    assert "(आपका: नहीं)" in reason.hi


# ------------------------------------------------------------------ results


def test_failed_reason_formats_income_in_indian_style():
    s = scheme([rule("inc", "annual_income", "lte", 250000)])
    [reason] = evaluate_scheme(s, Profile(annual_income=400000)).failed_reasons
    assert "₹4,00,000" in reason.en and "₹4,00,000" in reason.hi


def test_every_rule_result_carries_a_citation():
    s = scheme([rule("a", "age", "gte", 60), rule("b", "is_bpl", "eq", True, source_url="https://x.gov.in/pdf")])
    r = evaluate_scheme(s, Profile())
    assert all(x.clause for x in r.rule_results)
    assert r.rule_results[0].source_url == SRC  # falls back to scheme source
    assert r.rule_results[1].source_url == "https://x.gov.in/pdf"  # rule-level override


def test_missing_fields_are_deduplicated_in_order():
    s = scheme([rule("a", "age", "gte", 18), rule("b", "age", "lte", 40), rule("c", "is_bpl", "eq", True)])
    assert evaluate_scheme(s, Profile()).missing_fields == ["age", "is_bpl"]


def test_rank_and_missing_fields_across():
    s1 = scheme([rule("a", "age", "gte", 60)], id="s1")
    s2 = scheme([rule("a", "is_bpl", "eq", True), rule("b", "age", "gte", 18)], id="s2")
    s3 = scheme([rule("a", "is_farmer", "eq", True)], id="s3")
    results = evaluate_all(Profile(is_farmer=False, is_bpl=True), [s1, s2, s3])
    assert [r.status for r in results] == ["needs_info", "needs_info", "not_eligible"]
    ranked = rank_results(results)
    assert [r.scheme_id for r in ranked] == ["s2", "s1", "s3"]  # s2 has more rules passed
    assert missing_fields_across(results) == ["age"]


# ------------------------------------------------------------------ derivations


def test_not_a_student_implies_not_post_matric():
    assert normalize_profile(Profile(is_student=False)).is_post_matric_student is False


def test_post_matric_implies_student():
    assert normalize_profile(Profile(is_post_matric_student=True)).is_student is True


def test_normalize_does_not_override_explicit_values():
    p = normalize_profile(Profile(is_student=True, is_post_matric_student=False))
    assert p.is_student is True and p.is_post_matric_student is False
