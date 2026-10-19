"""Database migrations: fresh databases, and databases created before migrations existed."""

from __future__ import annotations

from sqlalchemy import create_engine, inspect, text

from app.db import migrate


def columns(engine, table):
    return {c["name"]: c for c in inspect(engine).get_columns(table)}


def test_fresh_database_gets_every_table(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/fresh.db")
    migrate(engine)
    tables = set(inspect(engine).get_table_names())
    assert {"users", "otp_codes", "auth_sessions", "saved_profiles", "known_schemes", "notifications", "alembic_version"} <= tables
    users = columns(engine, "users")
    assert users["phone"]["nullable"] and {"username", "password_hash", "failed_logins", "locked_until"} <= users.keys()


def test_pre_migration_database_is_upgraded_and_keeps_data(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/legacy.db")
    with engine.begin() as conn:  # the original create_all schema, with one user and no alembic_version
        conn.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, phone VARCHAR(16) NOT NULL UNIQUE, lang VARCHAR(2) NOT NULL, "
            "whatsapp_opt_in BOOLEAN NOT NULL, created_at DATETIME NOT NULL, last_login_at DATETIME NOT NULL)"
        ))
        conn.execute(text("INSERT INTO users VALUES (1, '+919000000001', 'hi', 1, '2026-10-17', '2026-10-17')"))
        for ddl in (
            "CREATE TABLE otp_codes (id INTEGER PRIMARY KEY, phone VARCHAR(16), code_hash VARCHAR(64), attempts INTEGER, consumed BOOLEAN, created_at DATETIME, expires_at DATETIME)",
            "CREATE TABLE auth_sessions (id INTEGER PRIMARY KEY, user_id INTEGER, token_hash VARCHAR(64), created_at DATETIME, expires_at DATETIME)",
            "CREATE TABLE saved_profiles (user_id INTEGER PRIMARY KEY, profile JSON, skipped JSON, updated_at DATETIME)",
            "CREATE TABLE known_schemes (scheme_id VARCHAR(64) PRIMARY KEY, first_seen_at DATETIME)",
            "CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER, scheme_id VARCHAR(64), channel VARCHAR(16), status VARCHAR(16), created_at DATETIME)",
        ):
            conn.execute(text(ddl))
    migrate(engine)
    migrate(engine)  # running again is a no-op
    with engine.connect() as conn:
        assert conn.execute(text("SELECT phone, lang FROM users")).one() == ("+919000000001", "hi")
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0002"
    assert "username" in columns(engine, "users")


def test_models_match_the_migrations(tmp_path):
    """Autogenerate finds nothing to change: app/db.py and migrations/ describe the same schema."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.db import Base

    engine = create_engine(f"sqlite:///{tmp_path}/compare.db")
    migrate(engine)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], diff

