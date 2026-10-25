"""encrypt reusable router-agent tokens at rest

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
"""

import sqlalchemy as sa

from alembic import op
from app.core.encryption import encrypt_value

revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None

TOKEN_PREFIX = "enc:v1:"


def upgrade() -> None:
    columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("routers")
    }
    if "agent_token_plain" not in columns:
        return

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT id, agent_token_plain FROM routers WHERE agent_token_plain IS NOT NULL"
        )
    ).mappings()
    for row in rows:
        value = row["agent_token_plain"]
        if not value.startswith(TOKEN_PREFIX):
            connection.execute(
                sa.text("UPDATE routers SET agent_token_plain = :token WHERE id = :id"),
                {
                    "id": row["id"],
                    "token": TOKEN_PREFIX + encrypt_value(value),
                },
            )


def downgrade() -> None:
    raise RuntimeError(
        "Refusing to downgrade encrypted router-agent tokens to plaintext. "
        "Restore using a compatible application version and reviewed recovery plan."
    )
