"""Validation tests for Profile, Rule and Scheme models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.i18n import format_inr, format_value
from app.models import Profile, Rule, Scheme, field_kind


def base_rule(**overrides):
    r = {
        "id": "r1",
        "field": "age",
        "op": "gte",
        "value": 60,
        "description": "d",
        "description_hi": "द",
        "clause": "c",
    }
    r.update(overrides)
    return r


# ------------------------------------------------------------------ profile


def test_aadhaar_and_unknown_fields_are_dropped():
    p = Profile(age=40, aadhaar_number="1234 5678 9012", aadhaar="x")
    dumped = p.model_dump()
    assert "aadhaar_number" not in dumped and "aadhaar" not in dumped
    assert not any("aadhaar" in k for k in Profile.model_fields)


@pytest.mark.parametrize("age", [-1, 121])
def test_age_out_of_range_rejected(age):
    with pytest.raises(ValidationError):
        Profile(age=age)


def test_negative_income_rejected():
    with pytest.raises(ValidationError):
        Profile(annual_income=-5)


def test_enum_values_are_lowercased():
    p = Profile(gender=" Female ", category="SC")
    assert p.gender == "female" and p.category == "sc"


def test_invalid_enum_rejected():
    with pytest.raises(ValidationError):
        Profile(category="brahmin")


def test_merge_keeps_old_values_and_overrides_with_new():
    old = Profile(age=65, is_farmer=True)
    new = Profile(is_bpl=True, age=66)
    merged = old.merged_with(new)
    assert (merged.age, merged.is_farmer, merged.is_bpl) == (66, True, True)


def test_field_kinds():
    assert field_kind("age") == "int"
    assert field_kind("is_bpl") == "bool"
    assert field_kind("category") == "enum"
    assert field_kind("state") == "str"


# ------------------------------------------------------------------ rule validation


def test_valid_rule():
    assert Rule(**base_rule()).op == "gte"


@pytest.mark.parametrize(
    "overrides,message",
    [
        ({"field": "aadhaar_number"}, "unknown profile field"),
        ({"field": "beneficiary_relation", "op": "eq", "value": "self"}, "unknown profile field"),
        ({"field": "is_bpl", "op": "gt", "value": 0}, "needs a numeric field"),
        ({"field": "is_bpl", "op": "eq", "value": "yes"}, "does not fit"),
        ({"field": "age", "op": "eq", "value": True}, "does not fit"),
        ({"field": "category", "op": "eq", "value": "SC"}, "does not fit"),
        ({"field": "category", "op": "in", "value": "sc"}, "non-empty list"),
        ({"field": "category", "op": "in", "value": []}, "non-empty list"),
        ({"op": "between"}, "op"),
    ],
)
def test_invalid_rules_rejected(overrides, message):
    with pytest.raises(ValidationError, match=message):
        Rule(**base_rule(**overrides))


def test_unknown_rule_key_rejected():
    with pytest.raises(ValidationError):
        Rule(**base_rule(weight=2))


# ------------------------------------------------------------------ scheme validation


def scheme_dict(rules):
    return {
        "id": "x",
        "name": "X",
        "name_hi": "एक्स",
        "ministry": "M",
        "topics": ["students"],
        "kind": "scholarship",
        "benefit": {"en": "b", "hi": "ब"},
        "documents": [{"en": "d", "hi": "द"}],
        "source_url": "https://x.gov.in/",
        "rules": rules,
    }


def test_duplicate_rule_ids_rejected():
    with pytest.raises(ValidationError, match="duplicate rule ids"):
        Scheme(**scheme_dict([base_rule(), base_rule()]))


def test_single_member_or_group_rejected():
    with pytest.raises(ValidationError, match="only one rule"):
        Scheme(**scheme_dict([base_rule(group="g")]))


def test_unknown_kind_rejected():
    d = scheme_dict([base_rule()])
    d["kind"] = "lottery"
    with pytest.raises(ValidationError):
        Scheme(**d)


def test_scheme_needs_a_topic():
    d = scheme_dict([base_rule()])
    d["topics"] = []
    with pytest.raises(ValidationError):
        Scheme(**d)


def test_new_enum_fields_are_lowercased():
    p = Profile(course_level=" Undergraduate ", highest_qualification="GRADUATE", business_status="Planning_New")
    assert (p.course_level, p.highest_qualification, p.business_status) == ("undergraduate", "graduate", "planning_new")


def test_non_https_source_rejected():
    d = scheme_dict([base_rule()])
    d["source_url"] = "http://x.gov.in/"
    with pytest.raises(ValidationError):
        Scheme(**d)


# ------------------------------------------------------------------ i18n


@pytest.mark.parametrize(
    "n,out", [(0, "₹0"), (999, "₹999"), (1000, "₹1,000"), (250000, "₹2,50,000"), (12345678, "₹1,23,45,678")]
)
def test_format_inr(n, out):
    assert format_inr(n) == out


def test_format_value_bilingual():
    assert format_value("is_bpl", True, "hi") == "हाँ"
    assert format_value("gender", "female", "hi") == "महिला"
    assert format_value("category", "sc", "en") == "SC"
    assert format_value("age", None, "en") == "not known"
