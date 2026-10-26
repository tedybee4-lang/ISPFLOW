from app.api.v1.business.vouchers import VoucherListItem


def test_voucher_inventory_response_omits_hotspot_credentials():
    response = VoucherListItem.model_validate({
        "id": 7,
        "code": "ABCD-EFGH",
        "status": "active",
        "hotspot_username": "subscriber-user",
        "hotspot_password": "one-time-secret",
    })

    serialized = response.model_dump()
    assert "hotspot_username" not in serialized
    assert "hotspot_password" not in serialized
