"""Chat assistant: basic (no-LLM) mode end to end, plus LLM mode with a fake model."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.ai.assistant as assistant
from app.ai.llm import LLMError
from app.api import app
from eval.run_chat_eval import load_cases, score

client = TestClient(app)


def say(message, **state):
    res = client.post("/api/chat", json={"message": message, **state})
    assert res.status_code == 200, res.text
    return res.json()


def test_status_is_basic_without_a_key():
    assert client.get("/api/chat/status").json() == {"ai_mode": "basic", "model": None}


def test_demo_utterance_fills_profile_and_decides_schemes():
    out = say("meri maa 65 ki hain, kisan hain, UP mein")
    assert out["ai_mode"] == "basic"
    assert out["language"] == "hinglish"
    p = out["profile"]
    assert (p["age"], p["gender"], p["is_farmer"], p["beneficiary_relation"]) == (65, "female", True, "mother")
    decided = {d["scheme_id"]: d["status"] for d in out["decided"]}
    assert decided["apy"] == "not_eligible"  # over 40
    assert out["pending_field"]  # a next question is asked
    assert out["reply"].startswith("Got it")
    assert {u["field"] for u in out["understood"]} >= {"age", "is_farmer"}


def test_answering_the_pending_question():
    out = say("haan", pending_field="is_bpl", profile={"age": 72})
    assert out["profile"]["is_bpl"] is True
    # Age 72 already made PM-JAY eligible; BPL now decides the old age pension.
    assert {"scheme_id": "ignoaps", "status": "eligible"}.items() <= next(
        d for d in out["decided"] if d["scheme_id"] == "ignoaps"
    ).items()


def test_dont_know_skips_the_question():
    out = say("pata nahi", pending_field="is_bpl", profile={"age": 72})
    assert "is_bpl" in out["skipped"]
    assert out["pending_field"] != "is_bpl"
    assert "is_bpl" not in out["profile"] or out["profile"]["is_bpl"] is None


def test_hindi_reply_for_devanagari_message():
    out = say("मेरी उम्र 45 साल है और मैं किसान हूँ", lang="hi")
    assert out["language"] == "hi"
    assert "समझ गया" in out["reply"]


def test_id_numbers_never_come_back():
    out = say("mera aadhaar 1234 5678 9012 hai, umar 30 saal")
    assert out["profile"]["age"] == 30
    assert "1234 5678 9012" not in str(out["profile"]) and "aadhaar" not in str(out["profile"]).lower()


def test_question_about_a_scheme_is_answered_from_scheme_data():
    out = say("PM Kisan ke documents kya hain?")
    assert out["schemes"][0] == "pm_kisan"
    assert "Aadhaar" in out["reply"] and "pmkisan.gov.in" in out["reply"]


def test_greeting_invites_the_user_to_describe_themselves():
    out = say("namaste")
    assert "Namaste" in out["reply"]
    assert out["pending_field"] is None  # no question pushed at the user


def test_wanting_to_ask_is_not_a_yes():
    # The bug reported from Safari: "hai" in this sentence was read as "yes, BPL".
    out = say("khuch aur puchna hai mujhe", pending_field="is_bpl", profile={"age": 72})
    assert out["profile"].get("is_bpl") is None
    assert out["reply"].startswith("Sure!")
    assert "?" not in out["reply"]  # answers, doesn't ask its own question
    assert out["pending_field"] == "is_bpl"  # the earlier question is still open for later


def test_general_question_is_answered_not_taken_as_a_fact():
    out = say("BPL kya hota hai?", pending_field="is_bpl", profile={"age": 72})
    assert out["profile"].get("is_bpl") is None
    assert "below poverty line" in out["reply"]


def test_glossary_beats_loose_scheme_matches():
    out = say("income certificate kaise banwaye?")
    assert out["schemes"] == [] and "tehsil" in out["reply"]


def test_question_about_a_kind_lists_those_schemes():
    out = say("scholarship ke liye kaun apply kar sakta hai?")
    assert out["reply"].startswith("Here are the scholarships") and "AICTE Pragati" in out["reply"]
    out = say("pension yojana kaun si hain?")
    assert out["schemes"] == [] and "Atal Pension Yojana" in out["reply"] and "Old Age Pension" in out["reply"]


@pytest.mark.parametrize(
    "message,expected",
    [("MUDRA loan kaise milega?", "MUDRA"), ("loan chahiye business ke liye, kaise milega?", "business loans"),
     ("padhai ke liye loan kaise milega?", "education loans")],
)
def test_loan_questions_route_by_purpose(message, expected):
    assert expected in say(message)["reply"]


@pytest.mark.parametrize(
    "text,expected",
    [("hai", True), ("haan ji", True), ("card hai", True), ("nahi hai", False), ("mere paas BPL card nahi hai", False),
     ("haan, mere paas card hai aur hum gaon mein rehte hain", True), ("khuch aur puchna hai mujhe", None),
     ("ye scheme kab tak chalegi hai kya pata", None)],
)
def test_yes_no_parsing(text, expected):
    from app.ai.fallback import parse_yes_no

    assert parse_yes_no(text) is expected


def test_llm_answers_general_questions_itself(monkeypatch):
    seen = {}
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "question", "fields": {}, "scheme_ids": [], "language": "hinglish"})

    def fake_reply(system, user):
        seen["system"], seen["facts"] = system, user
        return "BPL ka matlab hai garibi rekha se neeche..."

    monkeypatch.setattr(assistant, "chat_text", fake_reply)
    out = say("BPL kya hota hai?", pending_field="is_bpl")
    assert out["reply"].startswith("BPL ka matlab")
    assert '"general_question": true' in seen["facts"] and "next_question" not in seen["facts"]
    assert "general" in seen["system"] and "knowledge" in seen["system"]


def test_topic_limits_results():
    out = say("I am 20", topic="students")
    assert all("students" in r["topics"] for r in out["results"])


def test_llm_mode_output_is_validated(monkeypatch):
    monkeypatch.setattr(assistant, "chat_json", lambda system, user: {
        "intent": "info",
        "fields": {"age": "70", "gender": "FEMALE", "is_bpl": "maybe", "aadhaar_number": "1234", "made_up": 1},
        "scheme_ids": ["not_a_scheme"],
        "language": "hinglish",
    })
    monkeypatch.setattr(assistant, "chat_text", lambda system, user: "LLM wrote this")
    out = say("meri nani 70 ki hain")
    assert out["ai_mode"] == "llm" and out["reply"] == "LLM wrote this"
    assert out["profile"]["age"] == 70 and out["profile"]["gender"] == "female"
    assert out["profile"].get("is_bpl") is None  # invalid value dropped
    assert "aadhaar_number" not in out["profile"] and out["schemes"] == []


def test_llm_failure_falls_back_to_basic(monkeypatch):
    def boom(*_args, **_kwargs):
        raise LLMError("down")

    monkeypatch.setattr(assistant, "chat_json", boom)
    out = say("meri maa 65 ki hain")
    assert out["ai_mode"] == "basic" and out["profile"]["age"] == 65


def test_reply_falls_back_to_template_when_llm_reply_fails(monkeypatch):
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "info", "fields": {"age": 30}, "language": "en"})

    def boom(*_args, **_kwargs):
        raise LLMError("down")

    monkeypatch.setattr(assistant, "chat_text", boom)
    out = say("I am 30")
    assert out["ai_mode"] == "llm" and out["reply"].startswith("Got it")


def test_basic_parser_gets_every_standard_case_right():
    cases = [c for c in load_cases() if not c.get("llm_only")]
    result = score(cases, use_llm=False)
    misses = [(c["id"], got) for c, got, ok in result["rows"] if not ok]
    assert not misses, misses


@pytest.mark.parametrize("message", ["", "x" * 1001])
def test_message_length_is_bounded(message):
    assert client.post("/api/chat", json={"message": message}).status_code == 422


def test_scheme_answer_with_invented_dates_is_replaced(monkeypatch):
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "question", "fields": {}})
    monkeypatch.setattr(assistant, "chat_text", lambda s, u: "₹6,000 a year, paid in July, October and January.")
    out = say("PM Kisan mein kitna paisa milta hai aur kab?")
    assert "July" not in out["reply"]
    assert "pmkisan.gov.in" in out["reply"]  # the safe answer built from the scheme data


def test_questions_dont_push_the_pending_question(monkeypatch):
    seen = {}
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "chat", "fields": {}})

    def fake_reply(system, user):
        seen["facts"] = user
        return "Sure, what would you like to know?"

    monkeypatch.setattr(assistant, "chat_text", fake_reply)
    out = say("khuch aur puchna hai mujhe", pending_field="annual_income", profile={"age": 62})
    assert "next_question" not in seen["facts"] and "pending_question" not in seen["facts"]
    assert out["pending_field"] == "annual_income"  # still open; the quick-reply buttons can resume it


def test_markdown_is_stripped_from_llm_replies(monkeypatch):
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "chat", "fields": {}})
    monkeypatch.setattr(assistant, "chat_text", lambda s, u: "## Hi\n**Sure**, ask __anything__.")
    assert say("namaste ji, kuch puchna hai")["reply"] == "Hi\nSure, ask anything."


@pytest.mark.parametrize(
    "message,topic_name,includes",
    [("mujhe Saari scheme Ke baare mein Bata Do Jo Bhi ek Vidyarthi Ke liye Abhi Lagoo hain", "Students & youth", "PM Internship"),
     ("kisano ke liye kaun si yojana hai?", "Farmers", "PM-KISAN")],
)
def test_questions_about_a_group_list_catalogue_schemes(message, topic_name, includes):
    out = say(message)
    assert topic_name in out["reply"] and includes in out["reply"]
    assert "NMMS" not in out["reply"]  # nothing outside the catalogue


def test_voice_requests_ask_for_a_spoken_style(monkeypatch):
    seen = {}
    monkeypatch.setattr(assistant, "chat_json", lambda s, u: {"intent": "chat", "fields": {}})
    monkeypatch.setattr(assistant, "chat_text", lambda s, u: seen.setdefault("system", s) and "Ji, boliye!")
    say("mujhe kuch puchna hai", voice=True)
    assert "SPOKEN aloud" in seen["system"]
