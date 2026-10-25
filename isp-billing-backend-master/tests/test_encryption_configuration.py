import pytest

from app.core.config import Settings


def test_production_master_password_requires_a_stable_salt():
    with pytest.raises(ValueError, match="ENCRYPTION_SALT required"):
        Settings(
            environment="production",
            secret_key="a" * 64,
            encryption_key=None,
            master_password="test-master-password",
            encryption_salt=None,
            global_admin_password="non-default-test-password",
            onboarding_expose_dev_codes=False,
        )
