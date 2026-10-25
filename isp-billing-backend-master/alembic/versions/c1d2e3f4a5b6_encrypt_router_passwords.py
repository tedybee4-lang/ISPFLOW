"""encrypt router passwords stored in the routers table

Revision ID: c1d2e3f4a5b6
Revises: f7a8b9c0d1e2
"""

from alembic import op
import sqlalchemy as sa

from app.core.encryption import decrypt_value, encrypt_value


revision = "c1d2e3f4a5b6"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None

PASSWORD_PREFIX = "enc:v1:"


def upgrade() -> None:
    columns = {column["name"]: column for column in sa.inspect(op.get_bind()).get_columns("routers")}
    if "password" not in columns:
        return

    op.alter_column(
        "routers",
        "password",
        existing_type=columns["password"]["type"],
        type_=sa.String(512),
        existing_nullable=False,
    )

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, password FROM routers")).mappings()
    for row in rows:
        value = row["password"]
        if not value.startswith(PASSWORD_PREFIX):
            connection.execute(
                sa.text("UPDATE routers SET password = :password WHERE id = :id"),
                {
                    "id": row["id"],
                    "password": PASSWORD_PREFIX + encrypt_value(value),
                },
            )


def downgrade() -> None:
    columns = {column["name"]: column for column in sa.inspect(op.get_bind()).get_columns("routers")}
    if "password" not in columns:
        return

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, password FROM routers")).mappings()
    for row in rows:
        value = row["password"]
        if value.startswith(PASSWORD_PREFIX):
            connection.execute(
                sa.text("UPDATE routers SET password = :password WHERE id = :id"),
                {
                    "id": row["id"],
                    "password": decrypt_value(value[len(PASSWORD_PREFIX):]),
                },
            )

    op.alter_column(
        "routers",
        "password",
        existing_type=columns["password"]["type"],
        type_=sa.String(255),
        existing_nullable=False,
    )
