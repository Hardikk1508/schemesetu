"""Username + password login: users may have a username/password instead of (or as well as) a phone.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-19
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch mode rebuilds the table on SQLite, which can't otherwise drop NOT NULL.
    with op.batch_alter_table("users") as batch:
        batch.alter_column("phone", existing_type=sa.String(16), nullable=True)
        batch.add_column(sa.Column("username", sa.String(32), nullable=True))
        batch.add_column(sa.Column("password_hash", sa.String(255), nullable=True))
        batch.add_column(sa.Column("failed_logins", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("locked_until", sa.DateTime(), nullable=True))
        batch.create_index("ix_users_username", ["username"], unique=True)


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_index("ix_users_username")
        batch.drop_column("locked_until")
        batch.drop_column("failed_logins")
        batch.drop_column("password_hash")
        batch.drop_column("username")
        batch.alter_column("phone", existing_type=sa.String(16), nullable=False)
