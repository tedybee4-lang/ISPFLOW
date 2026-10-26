"""add payhero channel lifecycle status and nullable channel id

Revision ID: a1b2c3d4e5f6
Revises: fff2b9dcf212
Create Date: 2026-10-26 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "fff2b9dcf212"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tenant_payment_channels", "payhero_channel_id", existing_type=sa.Integer(), nullable=True)
    op.add_column("tenant_payment_channels", sa.Column("status", sa.String(length=30), nullable=False, server_default="not_configured"))
    op.add_column("tenant_payment_channels", sa.Column("last_error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tenant_payment_channels", "last_error")
    op.drop_column("tenant_payment_channels", "status")
    op.alter_column("tenant_payment_channels", "payhero_channel_id", existing_type=sa.Integer(), nullable=False)
