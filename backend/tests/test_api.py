"""HTTP API tests, run against the seed scheme data."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.models import RULE_FIELDS
from app.schemes import get_schemes

client = TestClient(app)


def check(profile=None, skipped=None):
    body = {"profile": profile or {}, "skipped": skipped or []}
    res = client.post("/api/eligibility", json=body)
    assert res.status_code == 200, res.text
    return res.json()


def statuses(payload):
    return {r["scheme_id"]: r["status"] for r in payload["results"]}


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


TOTAL = len(get_schemes())


def test_list_schemes_includes_rules_and_data_note():
    payload = client.get("/api/schemes").json()
    assert "SAMPLE DATA" in payload["data_note"]
    assert len(payload["schemes"]) == TOTAL
    assert all(s["rules"] and s["topics"] and s["kind"] for s in payload["schemes"])


def test_list_schemes_by_topic():
    schemes = client.get("/api/schemes", params={"topic": "students"}).json()["schemes"]
    assert schemes and all("students" in s["topics"] for s in schemes)
    assert {"csss", "pm_internship", "nats", "pm_vidyalaxmi"} <= {s["id"] for s in schemes}


def test_unknown_topic_is_404():
    assert client.get("/api/schemes", params={"topic": "nope"}).status_code == 404
    assert client.get("/api/topics/nope").status_code == 404
    assert client.post("/api/eligibility", json={"topic": "nope"}).status_code == 404


def test_topics_have_counts_and_kinds():
    topics = {t["id"]: t for t in client.get("/api/topics").json()}
    students = topics["students"]
    assert students["scheme_count"] == len(get_schemes("students"))
    assert sum(k["count"] for k in students["kinds"]) == students["scheme_count"]
    assert students["kinds"][0]["kind"] == "scholarship"  # most common first
    assert students["name"]["hi"] == "छात्र और युवा"
    assert all(t["scheme_count"] > 0 for t in topics.values())


def test_kinds_are_labelled_in_both_languages():
    kinds = client.get("/api/kinds").json()
    assert all(k["label"]["en"] and k["label"]["hi"] for k in kinds)


def test_read_scheme():
    assert client.get("/api/schemes/pm_kisan").json()["id"] == "pm_kisan"


def test_unknown_scheme_is_404():
    assert client.get("/api/schemes/nope").status_code == 404


def test_fields_cover_every_rule_field_in_both_languages():
    fields = client.get("/api/fields").json()
    assert [f["field"] for f in fields] == list(RULE_FIELDS)
    for f in fields:
        assert f["question"]["en"] and f["question"]["hi"], f["field"]


def test_field_metadata_shapes():
    by_name = {f["field"]: f for f in client.get("/api/fields").json()}
    assert (by_name["age"]["kind"], by_name["age"]["min"], by_name["age"]["max"]) == ("int", 0, 120)
    assert by_name["annual_income"]["min"] == 0 and by_name["annual_income"]["max"] is None
    assert [o["value"] for o in by_name["category"]["options"]] == ["general", "obc", "sc", "st"]
    assert by_name["category"]["options"][2]["label"]["hi"] == "अनुसूचित जाति (SC)"
    assert by_name["is_bpl"]["kind"] == "bool" and by_name["is_bpl"]["options"] == []
    assert (by_name["annual_income"]["unit"], by_name["age"]["unit"], by_name["is_bpl"]["unit"]) == ("inr", "years", None)


def test_empty_profile_needs_info_everywhere():
    payload = check()
    assert payload["summary"] == {"eligible": 0, "needs_info": TOTAL, "not_eligible": 0}
    assert payload["next_fields"], "should suggest something to ask"


def test_next_fields_put_most_useful_first():
    # Age appears in more schemes than any other field.
    assert check()["next_fields"][0] == "age"


def test_topic_limits_the_check():
    payload = client.post("/api/eligibility", json={"profile": {}, "topic": "students"}).json()
    assert len(payload["results"]) == len(get_schemes("students"))
    assert all("students" in r["topics"] for r in payload["results"])


def test_final_year_student_can_do_pm_internship():
    profile = {
        "age": 21, "is_student": True, "is_final_year": True, "highest_qualification": "class_12",
        "is_employed_full_time": False, "family_has_govt_employee": False,
    }
    payload = client.post("/api/eligibility", json={"profile": profile, "topic": "jobs"}).json()
    assert statuses(payload)["pm_internship"] == "eligible"


def test_results_are_ranked_and_counted():
    payload = check({"age": 72, "is_bpl": True, "gender": "female", "has_lpg_connection": False})
    ranks = {"eligible": 0, "needs_info": 1, "not_eligible": 2}
    order = [ranks[r["status"]] for r in payload["results"]]
    assert order == sorted(order)
    assert statuses(payload)["ignoaps"] == "eligible"
    assert statuses(payload)["pm_jay"] == "eligible"
    assert payload["summary"]["eligible"] == sum(r["status"] == "eligible" for r in payload["results"])


def test_skipped_fields_are_not_suggested_again():
    first = check()["next_fields"][0]
    assert first not in check(skipped=[first])["next_fields"]


def test_unknown_skipped_field_rejected():
    res = client.post("/api/eligibility", json={"profile": {}, "skipped": ["aadhaar_number"]})
    assert res.status_code == 422


def test_id_numbers_in_profile_are_dropped_not_echoed():
    payload = check({"age": 65, "aadhaar_number": "1234 5678 9012"})
    assert "1234 5678 9012" not in str(payload)


@pytest.mark.parametrize("profile", [{"age": -1}, {"age": "old"}, {"category": "brahmin"}])
def test_invalid_profile_values_rejected(profile):
    res = client.post("/api/eligibility", json={"profile": profile})
    assert res.status_code == 422
