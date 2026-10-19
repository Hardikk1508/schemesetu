"""Database: SQLAlchemy 2 ORM. SQLite by default; any SQLAlchemy URL works via DATABASE_URL,
e.g. postgresql+psycopg://user:pass@host/db or mysql+pymysql://user:pass@host/db.

Privacy: we store a phone number, saved eligibility answers (which contain no ID numbers;
see Profile) and notification history. Users can delete all of it (DELETE /api/me).
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from app.config import get_settings


def utcnow() -> datetime:
    """Naive UTC: SQLite drops time zones, so we store and compare naive UTC everywhere."""
    return datetime.now(UTC).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # A user has a phone (OTP login), a username + password, or both.
    phone: Mapped[str | None] = mapped_column(String(16), unique=True, index=True, nullable=True)  # E.164
    username: Mapped[str | None] = mapped_column(String(32), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)  # scrypt; never the password
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lang: Mapped[str] = mapped_column(String(2), default="en")
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    profile: Mapped[SavedProfile | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    sessions: Mapped[list[AuthSession]] = relationship(cascade="all, delete-orphan")
    notifications: Mapped[list[Notification]] = relationship(cascade="all, delete-orphan")


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(16), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256 of the cookie value
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class SavedProfile(Base):
    __tablename__ = "saved_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    profile: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    skipped: Mapped[list[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="profile")


class KnownScheme(Base):
    """Schemes already announced, so only newly added ones trigger WhatsApp alerts."""

    __tablename__ = "known_schemes"

    scheme_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "scheme_id", name="uq_notification_user_scheme"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scheme_id: Mapped[str] = mapped_column(String(64))
    channel: Mapped[str] = mapped_column(String(16))  # "whatsapp" or "console"
    status: Mapped[str] = mapped_column(String(16))  # "sent" or "failed"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


_engine: Engine | None = None
_sessionmaker: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine, _sessionmaker
    if _engine is None:
        url = get_settings().database_url
        kwargs: dict[str, Any] = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}  # FastAPI uses a thread pool
            db_path = url.removeprefix("sqlite:///")
            if db_path and db_path != ":memory:":
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(url, **kwargs)
        _sessionmaker = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def migrate(engine: Engine) -> None:
    """Bring the schema up to date with Alembic migrations (backend/migrations)."""
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect, text

    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        tables = set(inspect(connection).get_table_names())
        versioned = "alembic_version" in tables and bool(
            connection.execute(text("SELECT count(*) FROM alembic_version")).scalar()
        )
        if "users" in tables and not versioned:
            command.stamp(cfg, "0001")  # created by create_all before migrations existed
        command.upgrade(cfg, "head")


def init_db() -> None:
    migrate(get_engine())


def new_session() -> Session:
    get_engine()
    assert _sessionmaker is not None
    return _sessionmaker()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request."""
    db = new_session()
    try:
        yield db
    finally:
        db.close()
