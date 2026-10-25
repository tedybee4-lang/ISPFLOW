"""add tenant tax rate to organization settings

Revision ID: f7a8b9c0d1e2
Revises: e1f2a3b4c5d6
"""

from alembic import op
import sqlalchemy as sa


revision = "f7a8b9c0d1e2"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organization_settings")}
    if "tax_rate" not in columns:
        op.add_column(
            "organization_settings",
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="0.00"),
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("organization_settings")}
    if "tax_rate" in columns:
        op.drop_column("organization_settings", "tax_rate")
