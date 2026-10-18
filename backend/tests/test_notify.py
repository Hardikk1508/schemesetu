"""New-scheme WhatsApp alerts."""

from __future__ import annotations

import pytest
from sqlalchemy import delete

import app.notify as notify
from app.db import KnownScheme, Notification, SavedProfile, User, new_session
from app.messaging import SendResult
from app.models import Scheme
from app.schemes import get_schemes

NEW_SCHEME = Scheme(
    id="test_new_youth_grant",
    name="Test Youth Grant",
    name_hi="परीक्षण युवा अनुदान",
    ministry="Test Ministry",
    topics=["students"],
    kind="scholarship",
    benefit={"en": "₹1,000", "hi": "₹1,000"},
    documents=[{"en": "Aadhaar card", "hi": "आधार कार्ड"}],
    source_url="https://example.gov.in/",
    rules=[{"id": "r1", "field": "age", "op": "lte", "value": 25, "description": "25 or younger",
            "description_hi": "25 वर्ष या कम", "clause": "c"}],
)


@pytest.fixture
def db():
    with new_session() as session:
        for table in (Notification, KnownScheme, SavedProfile, User):
            session.execute(delete(table))
        session.commit()
        yield session


@pytest.fixture
def outbox(monkeypatch):
    sent: list[tuple[str, str]] = []

    def fake_send(phone, name, benefit, link, lang="en"):
        sent.append((phone, name))
        return SendResult(True, "console")

    monkeypatch.setattr(notify, "send_scheme_alert", fake_send)
    return sent


def add_user(db, phone, age, opt_in=True):
    user = User(phone=phone, whatsapp_opt_in=opt_in)
    user.profile = SavedProfile(profile={"age": age}, skipped=[])
    db.add(user)
    db.commit()
    return user


def test_first_run_only_records_catalogue(db, outbox):
    add_user(db, "+919000000101", 20)
    report = notify.notify_new_schemes(db)
    assert report.first_run and len(report.new_schemes) == len(get_schemes())
    assert outbox == []


def test_new_scheme_alerts_eligible_opted_in_users_once(db, outbox, monkeypatch):
    notify.notify_new_schemes(db)  # seed
    add_user(db, "+919000000102", 20)  # eligible, opted in
    add_user(db, "+919000000103", 40)  # not eligible
    add_user(db, "+919000000104", 20, opt_in=False)  # eligible but not opted in
    monkeypatch.setattr(notify, "get_schemes", lambda: [*get_schemes(), NEW_SCHEME])

    report = notify.notify_new_schemes(db)
    assert report.new_schemes == ["test_new_youth_grant"]
    assert outbox == [("+919000000102", "Test Youth Grant")]

    assert notify.notify_new_schemes(db).new_schemes == []  # now known
    assert len(outbox) == 1


def test_dry_run_sends_nothing_and_records_nothing(db, outbox, monkeypatch):
    notify.notify_new_schemes(db)
    add_user(db, "+919000000105", 20)
    monkeypatch.setattr(notify, "get_schemes", lambda: [*get_schemes(), NEW_SCHEME])
    report = notify.notify_new_schemes(db, dry_run=True)
    assert report.sent == [("+919000000105", "test_new_youth_grant")]
    assert outbox == []
    assert notify.notify_new_schemes(db).new_schemes == ["test_new_youth_grant"]  # still new
