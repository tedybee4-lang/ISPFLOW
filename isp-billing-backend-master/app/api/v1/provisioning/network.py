"""
Network calculation endpoints for provisioning.
Handles IP address calculations and network configuration.
"""
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from ipaddress import IPv4Network
from app.models.user import User
from app.api.deps import require_technician_or_admin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/calc")
async def calculate_network(
    subnet_address: str = Query("172.31.0.0"),
    cidr: int = Query(16, ge=8, le=30),
    current_user: User = Depends(require_technician_or_admin()),
):
    """Calculate gateway and DHCP pool suggestion for UI auto-calculation block."""
    try:
        # Validate and calculate network parameters
        net = IPv4Network(f"{subnet_address}/{cidr}", strict=False)
        hosts = list(net.hosts())
        
        # Keep the gateway at the first usable address and reserve the low
        # addresses for infrastructure before selecting the DHCP range.
        gateway = str(hosts[0])
        preferred_pool_start = net.network_address + (25_600 if cidr == 16 else 100)
        pool_start = str(
            preferred_pool_start
            if preferred_pool_start in net and preferred_pool_start < hosts[-1]
            else hosts[min(9, len(hosts) - 1)]
        )
        preferred_pool_end = net.network_address + (51_200 if cidr == 16 else 200)
        last_pool_host = hosts[-2] if len(hosts) > 2 else hosts[-1]
        pool_end = str(min(preferred_pool_end, last_pool_host))
        
        # Calculate total hosts
        total_hosts = len(list(net.hosts()))
        
        return {
            "subnet_address": subnet_address,
            "cidr": cidr,
            "network": str(net.network_address) + f"/{cidr}",
            "gateway": gateway,
            "dhcp_pool_start": pool_start,
            "dhcp_pool_end": pool_end,
            "dhcp_pool": f"{pool_start} - {pool_end}",
            "network_mask": str(net.netmask),
            "total_hosts": total_hosts,
        }
    
    except Exception as e:
        logger.error(f"Failed to calculate network parameters: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid network parameters: {e}")


@router.get("/validate")
async def validate_network_config(
    subnet_address: str = Query(...),
    cidr: int = Query(...),
    gateway: str = Query(...),
    current_user: User = Depends(require_technician_or_admin()),
):
    """Validate network configuration parameters."""
    try:
        # Validate network
        net = IPv4Network(f"{subnet_address}/{cidr}", strict=False)
        
        # Check if gateway is within the network
        from ipaddress import IPv4Address
        gateway_ip = IPv4Address(gateway)
        is_gateway_valid = gateway_ip in net
        
        return {
            "valid": is_gateway_valid,
            "network": str(net),
            "gateway_in_network": is_gateway_valid,
            "available_hosts": len(list(net.hosts())),
        }
    
    except Exception as e:
        logger.error(f"Failed to validate network configuration: {e}")
        return {"valid": False, "error": str(e)}
