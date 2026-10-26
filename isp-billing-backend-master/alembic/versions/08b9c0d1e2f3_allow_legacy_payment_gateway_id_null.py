"""allow tenant-channel payment transactions without a legacy gateway id

Revision ID: 08b9c0d1e2f3
Revises: 07a8b9c0d1e2
"""

from alembic import op
import sqlalchemy as sa


revision = "08b9c0d1e2f3"
down_revision = "07a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "payment_transactions",
        "gateway_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    # New tenant-channel transactions intentionally have no legacy gateway id.
    # Reinstating NOT NULL would require fabricating gateway references.
    pass
