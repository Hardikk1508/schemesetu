"""Phone OTP login, sessions, saved answers, opt-in and account deletion."""

from __future__ import annotations

import itertools
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.accounts as accounts
from app.accounts import _otp_hash, normalize_phone
from app.api import app
from app.db import OtpCode, User, new_session, utcnow
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


# ------------------------------------------------------------------ username + password

_users = itertools.count(1)


def fresh_username() -> str:
    return f"tester_{next(_users)}"


def test_register_logs_in_and_me_shows_username():
    client = TestClient(app)
    name = fresh_username()
    res = client.post("/api/auth/register", json={"username": name.upper(), "password": "secret123"})
    assert res.status_code == 201, res.text
    me = client.get("/api/me").json()
    assert me["username"] == name and me["phone"] is None  # usernames are stored lowercase


def test_password_is_stored_hashed():
    from app.accounts import verify_password

    client = TestClient(app)
    name = fresh_username()
    client.post("/api/auth/register", json={"username": name, "password": "secret123"})
    with new_session() as db:
        stored = db.scalar(select(User).where(User.username == name)).password_hash
    assert stored.startswith("scrypt$") and "secret123" not in stored
    assert verify_password("secret123", stored) and not verify_password("secret124", stored)


def test_login_and_logout_with_password():
    name = fresh_username()
    TestClient(app).post("/api/auth/register", json={"username": name, "password": "secret123"})
    client = TestClient(app)
    assert client.post("/api/auth/login", json={"username": name, "password": "secret123"}).status_code == 200
    assert client.get("/api/me").json()["username"] == name
    client.post("/api/auth/logout")
    assert client.get("/api/me").status_code == 401


def test_wrong_password_and_unknown_user_look_the_same():
    name = fresh_username()
    client = TestClient(app)
    client.post("/api/auth/register", json={"username": name, "password": "secret123"})
    wrong = client.post("/api/auth/login", json={"username": name, "password": "nope12345"})
    unknown = client.post("/api/auth/login", json={"username": "no_such_user_x", "password": "nope12345"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_five_wrong_passwords_lock_the_account():
    name = fresh_username()
    client = TestClient(app)
    client.post("/api/auth/register", json={"username": name, "password": "secret123"})
    for _ in range(5):
        assert client.post("/api/auth/login", json={"username": name, "password": "wrong1234"}).status_code == 401
    # Locked: even the right password is refused for now.
    assert client.post("/api/auth/login", json={"username": name, "password": "secret123"}).status_code == 429


def test_duplicate_username_rejected():
    name = fresh_username()
    TestClient(app).post("/api/auth/register", json={"username": name, "password": "secret123"})
    res = TestClient(app).post("/api/auth/register", json={"username": name, "password": "other1234"})
    assert res.status_code == 409


@pytest.mark.parametrize(
    "username,password",
    [("ab", "secret123"), ("has space", "secret123"), ("bad!name", "secret123"), ("okname", "short1"),
     ("okname2", "onlyletters"), ("okname3", "12345678")],
)
def test_invalid_registration_rejected(username, password):
    assert TestClient(app).post("/api/auth/register", json={"username": username, "password": password}).status_code == 422


def test_username_account_needs_a_phone_for_whatsapp_and_can_add_one(outbox):
    client = TestClient(app)
    client.post("/api/auth/register", json={"username": fresh_username(), "password": "secret123"})
    assert client.patch("/api/me", json={"whatsapp_opt_in": True}).status_code == 400
    phone = fresh_phone()
    code = request_code(client, phone, outbox)
    me = client.post("/api/auth/otp/verify", json={"phone": phone, "code": code}).json()
    assert me["phone"] == f"+91{phone}" and me["username"]  # same account, now with a phone
    assert client.patch("/api/me", json={"whatsapp_opt_in": True}).json()["whatsapp_opt_in"] is True


def test_cannot_add_a_phone_that_belongs_to_someone_else(outbox):
    phone = fresh_phone()
    login(TestClient(app), phone, outbox)  # the phone now has its own account
    client = TestClient(app)
    client.post("/api/auth/register", json={"username": fresh_username(), "password": "secret123"})
    # A fresh code for that phone (inserted directly, to skip the 30-second resend limit).
    with new_session() as db:
        db.add(OtpCode(phone=f"+91{phone}", code_hash=_otp_hash(f"+91{phone}", "246810"), expires_at=utcnow() + timedelta(minutes=5)))
        db.commit()
    res = client.post("/api/auth/otp/verify", json={"phone": phone, "code": "246810"})
    assert res.status_code == 409
