"""Checks on the seed scheme data and the labelled eval set."""

from __future__ import annotations

import json
import re

import pytest

from app.models import Profile
from app.schemes import DATA_FILE, data_note, get_scheme, get_schemes, get_topics, load_catalogue_from
from app.services.rules_engine import evaluate_scheme
from eval.run_eval import load_cases, run

DEVANAGARI = re.compile(r"[ऀ-ॿ]")
ORIGINAL_IDS = {"pm_kisan", "ignoaps", "pm_jay", "pmuy", "pms_sc", "apy", "ssy"}


def test_all_seed_schemes_load():
    ids = {s.id for s in get_schemes()}
    assert ORIGINAL_IDS <= ids
    assert len(ids) >= 30


def test_every_topic_has_schemes_and_every_scheme_a_known_topic():
    topic_ids = {t.id for t in get_topics()}
    assert {"students", "jobs", "business", "farmers", "women"} <= topic_ids
    for t in topic_ids:
        assert get_schemes(t), t
    for s in get_schemes():
        assert set(s.topics) <= topic_ids, s.id


def test_ministries_have_hindi_names():
    for s in get_schemes():
        assert s.ministry_hi and DEVANAGARI.search(s.ministry_hi), s.id


def test_notes_are_bilingual():
    for s in get_schemes():
        if s.notes:
            assert DEVANAGARI.search(s.notes.hi), s.id


def test_unknown_topic_in_catalogue_rejected(tmp_path):
    bad = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    bad["schemes"][0]["topics"] = ["martians"]
    path = tmp_path / "schemes.json"
    path.write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ValueError, match="unknown topic"):
        load_catalogue_from(path)


@pytest.mark.parametrize(
    "profile,scheme_id,status",
    [
        # 20-year-old OBC BTech girl, ₹3 lakh family income
        (dict(gender="female", is_student=True, course_level="undergraduate", is_technical_course=True,
              annual_income=300000, category="obc"), "aicte_pragati", "eligible"),
        (dict(gender="female", is_student=True, course_level="undergraduate", is_technical_course=True,
              annual_income=300000, category="obc"), "pm_yasasvi_post", "not_eligible"),
        # Studying a degree implies post-matric, so no extra question is needed.
        (dict(category="st", course_level="undergraduate", annual_income=200000), "pms_st", "eligible"),
        (dict(is_student=True, course_level="undergraduate", class12_top20=True, annual_income=400000,
              gets_other_scholarship=False), "csss", "eligible"),
        (dict(is_student=True, course_level="undergraduate", class12_top20=True, annual_income=450000,
              gets_other_scholarship=False), "csss", "not_eligible"),
        # Not a farmer -> not a small farmer either, so PM-KMY is decided.
        (dict(is_farmer=False), "pm_kmy", "not_eligible"),
        (dict(gender="male", category="general", business_status="planning_new", age=30), "standup_india", "not_eligible"),
        (dict(gender="male", category="sc", business_status="planning_new", age=30), "standup_india", "eligible"),
    ],
)
def test_new_scheme_rules(profile, scheme_id, status):
    assert evaluate_scheme(get_scheme(scheme_id), Profile(**profile)).status == status


def test_seed_data_is_flagged_unverified():
    assert "SAMPLE DATA" in data_note()
    for s in get_schemes():
        assert s.verified is False, s.id
        assert s.last_verified is None, s.id


def test_every_scheme_has_hindi_text():
    for s in get_schemes():
        assert DEVANAGARI.search(s.name_hi), s.id
        assert DEVANAGARI.search(s.benefit.hi), s.id
        assert all(DEVANAGARI.search(d.hi) for d in s.documents), s.id
        assert all(DEVANAGARI.search(r.description_hi) for r in s.rules), s.id


def test_every_rule_has_a_citation():
    for s in get_schemes():
        assert s.source_url.startswith("https://")
        assert all(r.clause.strip() for r in s.rules), s.id


def test_pmjay_uses_or_group():
    groups = [r.group for r in get_scheme("pm_jay").rules]
    assert groups == ["basis", "basis"]


def test_get_unknown_scheme_raises():
    with pytest.raises(KeyError):
        get_scheme("does_not_exist")


def test_demo_utterance_profile():
    """'meri maa 65 ki hain, kisan hain, UP mein' -> APY out on age, the rest need info."""
    p = Profile(age=65, gender="female", state="Uttar Pradesh", is_farmer=True)
    assert evaluate_scheme(get_scheme("apy"), p).status == "not_eligible"
    pmk = evaluate_scheme(get_scheme("pm_kisan"), p)
    assert pmk.status == "needs_info"
    assert pmk.passed_count == 1
    assert pmk.missing_fields == ["owns_cultivable_land", "is_income_tax_payer", "is_govt_employee"]


# ------------------------------------------------------------------ eval set


def test_eval_set_size_and_ids():
    cases = load_cases()
    assert len(cases) >= 16
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)), "duplicate case ids"


def test_eval_covers_every_scheme_and_status():
    cases = load_cases()
    schemes_seen = {sid for c in cases for sid in c["expected"]}
    statuses_seen = {st for c in cases for st in c["expected"].values()}
    assert schemes_seen == {s.id for s in get_schemes()}
    assert statuses_seen == {"eligible", "not_eligible", "needs_info"}


def test_eval_accuracy_is_100_percent():
    report = run()
    mismatches = [f"{m.case_id}/{m.scheme_id}: {m.expected} != {m.actual}" for m in report.mismatches]
    assert report.accuracy == 1.0, mismatches
