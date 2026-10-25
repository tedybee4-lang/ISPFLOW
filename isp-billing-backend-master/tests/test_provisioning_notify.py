import pytest
from datetime import datetime
import logging

from app.core.security import create_access_token
from app.services.ping_monitor import ping_monitor


async def test_provisioning_notify_records_pending_checkin(
    client, test_admin_user, caplog
):
    token = create_access_token({
        "sub": str(test_admin_user.id),
        "type": "provisioning",
        "permissions": ["provisioning.execute"],
    })
    test_ip = "198.51.100.55"

    try:
        with caplog.at_level(logging.WARNING, logger="httpx"):
            response = await client.post(
                "/api/v1/provisioning/bootstrap/notify",
                params={
                    "token": token,
                    "identity": "UnitTest",
                    "ip_address": test_ip,
                },
            )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["session_id"] is None
        assert body["note"] == "pending_checkin_recorded"

        assert test_ip in ping_monitor.pending_checkins
        info = ping_monitor.pending_checkins[test_ip]
        assert info.get("identity") == "UnitTest" or "timestamp" in info
    finally:
        ping_monitor.pending_checkins.pop(test_ip, None)
