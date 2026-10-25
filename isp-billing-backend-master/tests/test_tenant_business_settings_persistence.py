from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.api.v1.tenant.settings import (
    BusinessSettingsUpdate,
    get_business_settings,
    update_business_settings,
)


class _Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _Session:
    def __init__(self, settings):
        self.settings = settings
        self.commits = 0

    async def execute(self, _statement):
        return _Result(self.settings)

    def add(self, value):
        self.settings = value

    async def commit(self):
        self.commits += 1

    async def refresh(self, _value):
        return None


@pytest.mark.asyncio
async def test_business_settings_reads_fields_from_persisted_models():
    settings = SimpleNamespace(
        tax_rate=Decimal("16.00"),
        invoice_prefix="ISP",
        invoice_footer="Payment due within seven days",
    )
    organization = SimpleNamespace(
        id=4,
        currency="KES",
        terms_of_service="Acceptable use terms",
        privacy_policy="Privacy notice",
    )

    result = await get_business_settings(
        db=_Session(settings),
        current_user=SimpleNamespace(id=3),
        organization=organization,
    )

    assert result.tax_rate == 16.0
    assert result.invoice_prefix == "ISP"
    assert result.invoice_notes == "Payment due within seven days"
    assert result.terms_and_conditions == "Acceptable use terms"
    assert result.privacy_policy == "Privacy notice"


@pytest.mark.asyncio
async def test_business_settings_updates_existing_persistent_fields():
    settings = SimpleNamespace(
        tax_rate=Decimal("0.00"),
        invoice_prefix="INV",
        invoice_footer=None,
    )
    organization = SimpleNamespace(
        id=4,
        currency="KES",
        terms_of_service=None,
        privacy_policy=None,
    )
    db = _Session(settings)

    result = await update_business_settings(
        data=BusinessSettingsUpdate(
            tax_rate=16,
            invoice_prefix="ISP",
            invoice_notes="Invoice footer",
            terms_and_conditions="Terms",
            privacy_policy="Privacy",
        ),
        db=db,
        current_user=SimpleNamespace(id=3),
        organization=organization,
    )

    assert db.commits == 1
    assert settings.tax_rate == 16
    assert settings.invoice_prefix == "ISP"
    assert settings.invoice_footer == "Invoice footer"
    assert organization.terms_of_service == "Terms"
    assert organization.privacy_policy == "Privacy"
    assert result.invoice_notes == "Invoice footer"
