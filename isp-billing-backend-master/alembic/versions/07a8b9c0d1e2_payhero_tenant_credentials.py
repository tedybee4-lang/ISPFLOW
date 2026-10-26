"""store tenant PayHero credentials and payment-channel associations

Revision ID: 07a8b9c0d1e2
Revises: c7d8e9f0a1b2
"""

from alembic import op
import sqlalchemy as sa


revision = "07a8b9c0d1e2"
down_revision = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_payment_channels",
        sa.Column("payhero_account_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "tenant_payment_channels",
        sa.Column("api_token_encrypted", sa.Text(), nullable=True),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("tenant_payment_channel_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_payment_transactions_tenant_payment_channel_id",
        "payment_transactions",
        ["tenant_payment_channel_id"],
    )
    op.create_foreign_key(
        "fk_payment_transactions_tenant_payment_channel_id",
        "payment_transactions",
        "tenant_payment_channels",
        ["tenant_payment_channel_id"],
        ["id"],
    )
    op.execute(
        sa.text(
            "UPDATE tenant_payment_channels "
            "SET payhero_channel_id = NULL, is_active = false, is_verified = false, "
            "status = 'requires_attention', "
            "last_error = 'Re-enter tenant PayHero credentials and verify the channel.'"
        )
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_payment_transactions_tenant_payment_channel_id",
        "payment_transactions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_payment_transactions_tenant_payment_channel_id",
        table_name="payment_transactions",
    )
    op.drop_column("payment_transactions", "tenant_payment_channel_id")
    op.drop_column("tenant_payment_channels", "api_token_encrypted")
    op.drop_column("tenant_payment_channels", "payhero_account_id")
