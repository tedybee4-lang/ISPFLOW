"""Tests for offline RouterOS command generation and mocked execution."""

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.provisioning import ServiceType
from app.modules.provisioning.commands import (
    execute_command_with_retry,
    generate_configuration_commands,
    generate_hotspot_commands,
    generate_pppoe_commands,
    load_command_templates,
)


def test_command_templates_expose_supported_sections():
    templates = load_command_templates()

    assert set(templates) == {"connection", "security"}
    assert "system_info" in templates["connection"]
    assert "create_firewall_rules" in templates["security"]


def test_configuration_generation_returns_structured_commands_and_excludes_wan():
    commands = generate_configuration_commands(
        {
            "router_identity": "test-router",
            "bridge_ports": ["ether1", "ether2"],
            "wan_interface": "ether1",
            "subnet_address": "192.168.50.0",
            "cidr": 24,
        },
        ServiceType.HOTSPOT,
        routeros_version="7.18.2",
    )

    assert commands
    assert all(
        {"type", "command", "description", "critical"} <= set(command)
        for command in commands
    )
    assert any("/system/identity/set name=test-router" in c["command"] for c in commands)
    bridge_ports = [
        command["command"]
        for command in commands
        if "/interface/bridge/port/add" in command["command"]
    ]
    assert len(bridge_ports) == 1
    assert "interface=ether2" in bridge_ports[0]
    assert all("interface=ether1" not in command for command in bridge_ports)


def test_configuration_generation_supports_routeros_v6_ntp_syntax():
    commands = generate_configuration_commands(
        {"identity": "v6-test"},
        ServiceType.BRIDGE,
        routeros_version="6.49.10",
    )

    assert any("primary-ntp=" in command["command"] for command in commands)
    ntp_commands = [
        command["command"]
        for command in commands
        if command["command"].startswith("/system/ntp/client/set")
    ]
    assert len(ntp_commands) == 1
    assert "servers=" not in ntp_commands[0]
    assert "primary-ntp=" in ntp_commands[0]


def test_hotspot_command_generation_is_local_and_structured():
    commands = generate_hotspot_commands(
        {
            "hotspot_name": "test-hotspot",
            "billing_server_url": "https://billing.example.invalid",
            "organization_slug": "test-isp",
        }
    )

    assert commands
    assert all(command["type"] == "api_call" for command in commands)
    assert any(
        "test-hotspot" in command["command"] or "test-hotspot" in command["description"]
        for command in commands
    )
    assert any(
        command["command"].startswith("/ip/hotspot/profile/add")
        for command in commands
    )


def test_pppoe_command_generation_is_local_and_structured():
    commands = generate_pppoe_commands(
        {"service_name": "test-pppoe", "bridge_name": "test-bridge"}
    )

    assert len(commands) == 2
    assert all(command["type"] == "api_call" for command in commands)
    assert any("service-name=test-pppoe" in command["command"] for command in commands)


@pytest.mark.asyncio
async def test_execute_command_with_retry_uses_only_the_supplied_mock_client():
    db = MagicMock()
    command_holder = []

    def add_command(command):
        command_holder.append(command)

    async def commit_command():
        command_holder[0].max_retries = 0

    db.add.side_effect = add_command
    db.commit = AsyncMock(side_effect=commit_command)
    session = SimpleNamespace(id=1, session_id=None)
    connection = object()
    client = SimpleNamespace(execute_command=AsyncMock(return_value={"ok": True}))
    command_data = {
        "type": "api_call",
        "command": "/system/identity/print",
        "description": "Read router identity",
        "critical": False,
    }

    success, updated_connection = await execute_command_with_retry(
        db=db,
        retry_delays=[],
        logger=logging.getLogger(__name__),
        session=session,
        client=client,
        connection=connection,
        command_data=command_data,
    )

    assert success is True
    assert updated_connection is connection
    client.execute_command.assert_awaited_once_with(connection, command_data["command"])
    db.add.assert_called_once()
    db.commit.assert_awaited()
