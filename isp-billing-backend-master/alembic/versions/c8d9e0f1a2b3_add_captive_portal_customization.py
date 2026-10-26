"""add captive portal customization, versions, and sync logs

Revision ID: c8d9e0f1a2b3
Revises: 08b9c0d1e2f3
"""

from alembic import op
import sqlalchemy as sa


revision = "c8d9e0f1a2b3"
down_revision = "08b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "captive_portal_settings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), unique=True, nullable=False, index=True),
        sa.Column("theme", sa.String(50), nullable=False, server_default="modern"),
        sa.Column("colors", sa.JSON(), nullable=True),
        sa.Column("layout", sa.String(50), nullable=False, server_default="grid-3"),
        sa.Column("package_order", sa.JSON(), nullable=True),
        sa.Column("featured_package_ids", sa.JSON(), nullable=True),
        sa.Column("sort_mode", sa.String(30), nullable=False, server_default="manual"),
        sa.Column("typography", sa.JSON(), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("isp_name", sa.String(200), nullable=True),
        sa.Column("tagline", sa.String(300), nullable=True),
        sa.Column("support_phone", sa.String(50), nullable=True),
        sa.Column("whatsapp_contact", sa.String(50), nullable=True),
        sa.Column("footer_info", sa.Text(), nullable=True),
        sa.Column("welcome_heading", sa.String(200), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("connection_status_text", sa.String(200), nullable=True),
        sa.Column("payment_instructions", sa.Text(), nullable=True),
        sa.Column("success_message", sa.String(300), nullable=True),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("visibility", sa.JSON(), nullable=True),
        sa.Column("card_style", sa.JSON(), nullable=True),
        sa.Column("mobile_columns", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tablet_columns", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("desktop_columns", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("card_spacing", sa.Integer(), nullable=False, server_default="16"),
        sa.Column("published_version_id", sa.Integer(), nullable=True),
        sa.Column("current_version_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "captive_portal_versions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("published_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("organization_id", "version_number", name="uq_org_portal_version"),
    )
    op.create_table(
        "captive_portal_sync_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("router_id", sa.Integer(), sa.ForeignKey("routers.id"), nullable=True, index=True),
        sa.Column("version_id", sa.Integer(), sa.ForeignKey("captive_portal_versions.id"), nullable=True, index=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("rolled_back_from_version_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("captive_portal_sync_logs")
    op.drop_table("captive_portal_versions")
    op.drop_table("captive_portal_settings")

