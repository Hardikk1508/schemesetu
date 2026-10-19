"""Login (phone OTP or username + password), sessions, saved answers and WhatsApp alert opt-in.

Sessions live in an HttpOnly cookie; the database keeps only a sha256 of the token.
OTP codes are stored as HMACs, expire after 10 minutes and allow 5 attempts.
Passwords are stored as salted scrypt hashes; 5 wrong passwords lock the account for 15 minutes.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import AuthSession, OtpCode, SavedProfile, User, get_db, utcnow
from app.messaging import send_otp
from app.models import RULE_FIELDS, Profile

router = APIRouter(prefix="/api")

SESSION_COOKIE = "ss_session"
SESSION_DAYS = 30
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_AFTER = timedelta(seconds=30)
OTP_MAX_PER_HOUR = 5
LOGIN_MAX_FAILURES = 5
LOGIN_LOCK = timedelta(minutes=15)
USERNAME = re.compile(r"^[a-z0-9_.]{3,32}$")


def normalize_phone(raw: str) -> str:
    """Indian mobile numbers only: '098765 43210', '+91 98765-43210' -> '+919876543210'."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("enter a 10-digit Indian mobile number")
    return f"+91{digits}"


def _otp_hash(phone: str, code: str) -> str:
    return hmac.new(get_settings().secret_key.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# scrypt: memory-hard and in the standard library (no extra dependency).
_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${b64(salt)}${b64(key)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, key = stored.split("$")
        if algo != "scrypt":
            return False
        expected = base64.b64decode(key)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Checked against when the username doesn't exist, so response time doesn't reveal which usernames are taken.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


# --------------------------------------------------------------------------- schemas


class PhoneIn(BaseModel):
    phone: str
    lang: Literal["en", "hi"] = "en"

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)


class OtpVerifyIn(PhoneIn):
    code: str = Field(pattern=r"^\d{6}$")


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    lang: Literal["en", "hi"] = "en"

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME.fullmatch(v):
            raise ValueError("use 3–32 letters, numbers, dots or underscores")
        return v


class RegisterIn(Credentials):
    @field_validator("password")
    @classmethod
    def _strong_enough(cls, v: str) -> str:
        if v.isdigit() or v.isalpha():
            raise ValueError("use letters and numbers")
        return v


class OtpSent(BaseModel):
    """The code itself is never returned: it only goes to the phone (or is fixed, for test numbers)."""

    sent: bool
    channel: str


class SavedAnswers(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    skipped: list[str] = []
    updated_at: str | None = None

    @field_validator("skipped")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        return [f for f in v if f in RULE_FIELDS]


class Me(BaseModel):
    phone: str | None
    username: str | None
    lang: str
    whatsapp_opt_in: bool
    saved: SavedAnswers | None


class MeUpdate(BaseModel):
    whatsapp_opt_in: bool | None = None
    lang: Literal["en", "hi"] | None = None


def _me(user: User) -> Me:
    saved = None
    if user.profile:
        saved = SavedAnswers(
            profile=Profile(**user.profile.profile),
            skipped=user.profile.skipped,
            updated_at=user.profile.updated_at.isoformat() + "Z",
        )
    return Me(phone=user.phone, username=user.username, lang=user.lang, whatsapp_opt_in=user.whatsapp_opt_in, saved=saved)


def _start_session(user: User, response: Response, db: Session) -> None:
    now = utcnow()
    user.last_login_at = now
    db.flush()
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(user_id=user.id, token_hash=_token_hash(token), expires_at=now + timedelta(days=SESSION_DAYS)))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=get_settings().is_production,
        path="/",
    )


def _session_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == _token_hash(token)))
    if session is None or session.expires_at < utcnow():
        return None
    return db.get(User, session.user_id)


# --------------------------------------------------------------------------- dependencies

DB = Annotated[Session, Depends(get_db)]


def current_user(db: DB, ss_session: Annotated[str | None, Cookie()] = None) -> User:
    user = _session_user(db, ss_session)
    if user is None:
        raise HTTPException(status_code=401, detail="not logged in")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


# --------------------------------------------------------------------------- routes


@router.post("/auth/otp/request", response_model=OtpSent)
def request_otp(body: PhoneIn, db: DB) -> OtpSent:
    now = utcnow()
    recent = db.scalars(
        select(OtpCode).where(OtpCode.phone == body.phone, OtpCode.created_at > now - timedelta(hours=1))
    ).all()
    if len(recent) >= OTP_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="too many codes requested; try again in an hour")
    if recent and max(r.created_at for r in recent) > now - OTP_RESEND_AFTER:
        raise HTTPException(status_code=429, detail="please wait 30 seconds before asking for another code")

    test_code = get_settings().otp_test_numbers.get(body.phone)
    code = test_code or f"{secrets.randbelow(1_000_000):06d}"
    db.add(OtpCode(phone=body.phone, code_hash=_otp_hash(body.phone, code), expires_at=now + OTP_TTL))
    db.commit()
    if test_code:
        return OtpSent(sent=True, channel="test")  # fictional number: nothing is sent
    result = send_otp(body.phone, code, body.lang)
    if not result.ok:
        raise HTTPException(status_code=502, detail="could not send the code; try again")
    return OtpSent(sent=True, channel=result.channel)


@router.post("/auth/otp/verify", response_model=Me)
def verify_otp(
    body: OtpVerifyIn, response: Response, db: DB, ss_session: Annotated[str | None, Cookie()] = None
) -> Me:
    """Logs in with the phone, or, for a logged-in account without a phone, adds this phone to it."""
    now = utcnow()
    otp = db.scalars(
        select(OtpCode)
        .where(OtpCode.phone == body.phone, OtpCode.consumed.is_(False), OtpCode.expires_at > now)
        .order_by(OtpCode.created_at.desc())
    ).first()
    if otp is None:
        raise HTTPException(status_code=400, detail="code expired; ask for a new one")
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="too many wrong attempts; ask for a new code")
    if not hmac.compare_digest(otp.code_hash, _otp_hash(body.phone, body.code)):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="wrong code")

    otp.consumed = True
    owner = db.scalar(select(User).where(User.phone == body.phone))
    current = _session_user(db, ss_session)
    if current is not None and current.phone is None:
        if owner is not None:
            db.commit()
            raise HTTPException(status_code=409, detail="this number already belongs to another account")
        current.phone = body.phone  # add the phone to the logged-in username account
        db.commit()
        return _me(current)
    user = owner or User(phone=body.phone, lang=body.lang)
    if owner is None:
        db.add(user)
    _start_session(user, response, db)
    return _me(user)


@router.post("/auth/register", response_model=Me, status_code=201)
def register(body: RegisterIn, response: Response, db: DB) -> Me:
    if db.scalar(select(User.id).where(User.username == body.username)):
        raise HTTPException(status_code=409, detail="that username is taken")
    user = User(username=body.username, password_hash=hash_password(body.password), lang=body.lang)
    db.add(user)
    _start_session(user, response, db)
    return _me(user)


@router.post("/auth/login", response_model=Me)
def login(body: Credentials, response: Response, db: DB) -> Me:
    now = utcnow()
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None or user.password_hash is None:
        verify_password(body.password, _DUMMY_HASH)  # same work as a real check
        raise HTTPException(status_code=401, detail="wrong username or password")
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=429, detail="too many wrong attempts; try again in 15 minutes")
    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= LOGIN_MAX_FAILURES:
            user.failed_logins, user.locked_until = 0, now + LOGIN_LOCK
        db.commit()
        raise HTTPException(status_code=401, detail="wrong username or password")
    user.failed_logins, user.locked_until = 0, None
    _start_session(user, response, db)
    return _me(user)


@router.post("/auth/logout", status_code=204)
def logout(response: Response, db: DB, ss_session: Annotated[str | None, Cookie()] = None) -> None:
    if ss_session:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == _token_hash(ss_session)))
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=Me)
def read_me(user: CurrentUser) -> Me:
    return _me(user)


@router.patch("/me", response_model=Me)
def update_me(body: MeUpdate, user: CurrentUser, db: DB) -> Me:
    if body.whatsapp_opt_in is not None:
        if body.whatsapp_opt_in and user.phone is None:
            raise HTTPException(status_code=400, detail="add a phone number to get WhatsApp alerts")
        user.whatsapp_opt_in = body.whatsapp_opt_in
    if body.lang is not None:
        user.lang = body.lang
    db.commit()
    return _me(user)


@router.put("/me/answers", response_model=Me)
def save_answers(body: SavedAnswers, user: CurrentUser, db: DB) -> Me:
    data = body.profile.model_dump(exclude_none=True)
    if user.profile is None:
        user.profile = SavedProfile(profile=data, skipped=body.skipped)
    else:
        user.profile.profile = data
        user.profile.skipped = body.skipped
        user.profile.updated_at = utcnow()
    db.commit()
    db.refresh(user)
    return _me(user)


@router.delete("/me", status_code=204)
def delete_me(response: Response, user: CurrentUser, db: DB) -> None:
    """Deletes the account and everything stored with it, including OTP records for the number."""
    if user.phone:
        db.execute(delete(OtpCode).where(OtpCode.phone == user.phone))
    db.delete(user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")

