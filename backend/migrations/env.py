"""Alembic environment. The database URL comes from app settings (DATABASE_URL), not alembic.ini.

Migrations run automatically when the API starts (app.db.init_db). To create a new one after
changing models in app/db.py, from backend/:
    .venv/bin/alembic revision --autogenerate -m "describe the change"
"""

from alembic import context
from sqlalchemy import create_engine

from app.config import get_settings
from app.db import Base

config = context.config
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,  # lets SQLite alter tables
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:  # called from app.db.migrate with an open connection
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(get_settings().database_url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
