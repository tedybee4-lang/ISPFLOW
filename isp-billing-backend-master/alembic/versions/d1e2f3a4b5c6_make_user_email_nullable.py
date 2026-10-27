"""make user email nullable for phone-only registration

Revision ID: d1e2f3a4b5c6
Revises: c8d9e0f1a2b3
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = "d1e2f3a4b5c6"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None

def upgrade():
    op.alter_column("users", "email", existing_type=sa.String(length=100), nullable=True)

def downgrade():
    op.alter_column("users", "email", existing_type=sa.String(length=100), nullable=False)
