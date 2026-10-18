"""Phone OTP login, sessions, saved answers, opt-in and account deletion."""

from __future__ import annotations

import itertools

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.accounts as accounts
from app.accounts import normalize_phone
from app.api import app
from app.db import OtpCode, User, new_session
from app.messaging import SendResult

_numbers = itertools.count(9000000001)


def fresh_phone() -> str:
    return str(next(_numbers))  # a different number per test, so rate limits don't collide


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Codes that would have gone to each phone, by number."""
    sent: dict[str, str] = {}

    def fake_send(phone, code, lang="en"):
        sent[phone] = code
        return SendResult(True, "console")

    monkeypatch.setattr(accounts, "send_otp", fake_send)
    return sent


def request_code(client: TestClient, phone: str, outbox: dict) -> str:
    res = client.post("/api/auth/otp/request", json={"phone": phone})
    assert res.status_code == 200, res.text
    return outbox[normalize_phone(phone)]


def login(client: TestClient, phone: str, outbox: dict) -> dict:
    code = request_code(client, phone, outbox)
    res = client.post("/api/auth/otp/verify", json={"phone": phone, "code": code})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.parametrize(
    "raw,expected",
    [("9876543210", "+919876543210"), ("+91 98765-43210", "+919876543210"), ("098765 43210", "+919876543210"),
     ("919876543210", "+919876543210")],
)
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["12345", "5876543210", "abcdefghij", "+1 415 555 0100"])
def test_invalid_phone_rejected(raw):
    assert TestClient(app).post("/api/auth/otp/request", json={"phone": raw}).status_code == 422


def test_login_flow_sets_cookie_and_me_works(outbox):
    client = TestClient(app)
    phone = fresh_phone()
    sent = client.post("/api/auth/otp/request", json={"phone": phone}).json()
    assert sent == {"sent": True, "channel": "console"}  # the code is never in the response
    code = outbox[f"+91{phone}"]

    me = client.post("/api/auth/otp/verify", json={"phone": phone, "code": code}).json()
    assert me["phone"] == f"+91{phone}" and me["whatsapp_opt_in"] is False and me["saved"] is None
    assert "ss_session" in client.cookies
    assert client.get("/api/me").json()["phone"] == f"+91{phone}"


def test_me_requires_login():
    assert TestClient(app).get("/api/me").status_code == 401


def test_resend_is_rate_limited():
    client = TestClient(app)
    phone = fresh_phone()
    assert client.post("/api/auth/otp/request", json={"phone": phone}).status_code == 200
    assert client.post("/api/auth/otp/request", json={"phone": phone}).status_code == 429


def test_wrong_code_counts_attempts_then_locks(outbox):
    client = TestClient(app)
    phone = fresh_phone()
    code = request_code(client, phone, outbox)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert client.post("/api/auth/otp/verify", json={"phone": phone, "code": wrong}).status_code == 400
    # Even the right code is refused once the attempts are used up.
    assert client.post("/api/auth/otp/verify", json={"phone": phone, "code": code}).status_code == 429


def test_code_works_only_once(outbox):
    client = TestClient(app)
    phone = fresh_phone()
    code = request_code(client, phone, outbox)
    assert client.post("/api/auth/otp/verify", json={"phone": phone, "code": code}).status_code == 200
    assert client.post("/api/auth/otp/verify", json={"phone": phone, "code": code}).status_code == 400


def test_otp_is_stored_hashed(outbox):
    client = TestClient(app)
    phone = fresh_phone()
    code = request_code(client, phone, outbox)
    with new_session() as db:
        row = db.scalars(select(OtpCode).where(OtpCode.phone == f"+91{phone}")).first()
    assert row is not None and code not in row.code_hash


def test_save_answers_drops_unknown_fields_and_round_trips(outbox):
    client = TestClient(app)
    login(client, fresh_phone(), outbox)
    body = {"profile": {"age": 21, "is_student": True, "aadhaar_number": "1234 5678 9012"}, "skipped": ["is_bpl", "nope"]}
    me = client.put("/api/me/answers", json=body).json()
    assert me["saved"]["profile"]["age"] == 21
    assert "aadhaar_number" not in me["saved"]["profile"]
    assert me["saved"]["skipped"] == ["is_bpl"]
    assert "1234 5678 9012" not in client.get("/api/me").text


def test_whatsapp_opt_in_and_language(outbox):
    client = TestClient(app)
    login(client, fresh_phone(), outbox)
    me = client.patch("/api/me", json={"whatsapp_opt_in": True, "lang": "hi"}).json()
    assert me["whatsapp_opt_in"] is True and me["lang"] == "hi"


def test_logout_ends_session(outbox):
    client = TestClient(app)
    login(client, fresh_phone(), outbox)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/me").status_code == 401


def test_delete_account_removes_everything(outbox):
    client = TestClient(app)
    phone = fresh_phone()
    login(client, phone, outbox)
    client.put("/api/me/answers", json={"profile": {"age": 30}, "skipped": []})
    assert client.delete("/api/me").status_code == 204
    with new_session() as db:
        assert db.scalar(select(User).where(User.phone == f"+91{phone}")) is None
        assert db.scalars(select(OtpCode).where(OtpCode.phone == f"+91{phone}")).first() is None
    assert client.get("/api/me").status_code == 401


def test_test_number_uses_fixed_code_and_sends_nothing(outbox):
    client = TestClient(app)
    res = client.post("/api/auth/otp/request", json={"phone": "99999 99999"}).json()
    assert res == {"sent": True, "channel": "test"} and outbox == {}
    assert client.post("/api/auth/otp/verify", json={"phone": "9999999999", "code": "123456"}).status_code == 200
