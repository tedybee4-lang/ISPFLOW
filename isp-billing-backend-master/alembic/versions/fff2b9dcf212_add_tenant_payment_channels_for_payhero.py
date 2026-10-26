"""add tenant payment channels for payhero

Revision ID: fff2b9dcf212
Revises: d2e3f4a5b6c7
Create Date: 2026-10-25 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "fff2b9dcf212"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_payment_channels",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("channel_type", sa.String(length=20), nullable=False),
        sa.Column("short_code", sa.String(length=20), nullable=False),
        sa.Column("account_number", sa.String(length=50), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=True),
        sa.Column("payhero_channel_id", sa.Integer(), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "payhero_channel_id", name="uq_org_payhero_channel"),
    )


def downgrade() -> None:
    op.drop_table("tenant_payment_channels")
