"""Tests for authenticated network calculation and safe script generation."""

import logging

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
class TestNetworkCalculation:
    """Test network calculation endpoint."""

    async def test_network_calc_requires_authorization(self, client: AsyncClient):
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=192.168.1.0&cidr=24"
        )

        assert response.status_code == 401

    async def test_network_calc_basic_subnet(self, client: AsyncClient, admin_auth_headers: dict):
        """Test basic network calculation with standard subnet."""
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=192.168.1.0&cidr=24",
            headers=admin_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["subnet_address"] == "192.168.1.0"
        assert data["cidr"] == 24
        assert data["gateway"] == "192.168.1.1"
        assert data["dhcp_pool_start"] == "192.168.1.100"
        assert data["dhcp_pool_end"] == "192.168.1.200"
        assert data["network_mask"] == "255.255.255.0"
        assert data["total_hosts"] == 254
        
    async def test_network_calc_custom_subnet(self, client: AsyncClient, admin_auth_headers: dict):
        """Test network calculation with custom subnet."""
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=10.0.0.0&cidr=16",
            headers=admin_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["subnet_address"] == "10.0.0.0"
        assert data["cidr"] == 16
        assert data["gateway"] == "10.0.0.1"
        assert data["dhcp_pool_start"] == "10.0.100.0"
        assert data["dhcp_pool_end"] == "10.0.200.0"
        assert data["network_mask"] == "255.255.0.0"
        assert data["total_hosts"] == 65534
        
    async def test_network_calc_small_subnet(self, client: AsyncClient, admin_auth_headers: dict):
        """Test network calculation with small subnet (/28)."""
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=172.16.1.0&cidr=28",
            headers=admin_auth_headers,
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["subnet_address"] == "172.16.1.0"
        assert data["cidr"] == 28
        assert data["gateway"] == "172.16.1.1"
        assert data["dhcp_pool_start"] == "172.16.1.10"
        assert data["dhcp_pool_end"] == "172.16.1.13"
        assert data["network_mask"] == "255.255.255.240"
        assert data["total_hosts"] == 14
        
    async def test_network_calc_uses_documented_defaults(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """The calculation endpoint has documented default network parameters."""
        response = await client.get(
            "/api/v1/provisioning/network/calc", headers=admin_auth_headers
        )

        assert response.status_code == 200
        assert response.json()["subnet_address"] == "172.31.0.0"
        assert response.json()["cidr"] == 16
        
    async def test_network_calc_invalid_subnet(self, client: AsyncClient, admin_auth_headers: dict):
        """Test network calculation with invalid subnet."""
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=invalid&cidr=24",
            headers=admin_auth_headers,
        )
        
        assert response.status_code == 400
        
    async def test_network_calc_invalid_cidr(self, client: AsyncClient, admin_auth_headers: dict):
        """Test network calculation with invalid CIDR."""
        response = await client.get(
            "/api/v1/provisioning/network/calc?subnet_address=192.168.1.0&cidr=50",
            headers=admin_auth_headers,
        )
        
        assert response.status_code == 422


class TestBootstrapCommandGeneration:
    """Test bootstrap command generation endpoint."""
    
    async def test_bootstrap_command_generation(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """Test bootstrap command generation."""
        response = await client.get(
            "/api/v1/provisioning/bootstrap/command", headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "command" in data
        assert "script_url" in data
        assert "/tool fetch mode=" in data["command"]
        assert "url=" in data["command"]
        assert "codevertex.rsc" in data["command"]
        assert "import codevertex.rsc" in data["command"]
    
    async def test_bootstrap_script_requires_provisioning_token(
        self, client: AsyncClient
    ):
        """Script retrieval rejects requests without a signed token."""
        response = await client.get(
            "/api/v1/provisioning/bootstrap/script"
        )
        
        assert response.status_code == 400

    async def test_bootstrap_script_generation(
        self, client: AsyncClient, test_admin_user, caplog
    ):
        """A signed provisioning token can retrieve the generated script."""
        token = create_access_token({
            "sub": str(test_admin_user.id),
            "username": test_admin_user.username,
            "role": test_admin_user.role.value,
        })

        with caplog.at_level(logging.WARNING, logger="httpx"):
            response = await client.get(
                "/api/v1/provisioning/bootstrap/script",
                params={"token": token, "identity": "Test-Only-Router"},
            )

        assert response.status_code == 200
        assert isinstance(response.text, str)
        assert "Bootstrap" in response.text
        assert "API service" in response.text


class TestProvisioningWorkflow:
    """Test provisioning workflow endpoints."""
    
    async def test_start_provisioning_missing_data(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """Test starting provisioning with missing data."""
        response = await client.post(
            "/api/v1/provisioning/workflow", json={}, headers=admin_auth_headers
        )
        
        assert response.status_code == 422  # Validation error
        
    async def test_provisioning_status_not_found(
        self, client: AsyncClient, admin_auth_headers: dict
    ):
        """Test getting status for non-existent session."""
        response = await client.get(
            "/api/v1/provisioning/sessions/999999/status", headers=admin_auth_headers
        )
        
        assert response.status_code == 404
