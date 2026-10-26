import base64
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class PayHeroClient:
    def __init__(self) -> None:
        self.base_url = (settings.payhero_base_url or "https://backend.payhero.co.ke").rstrip("/")
        self.username = settings.payhero_api_username
        self.password = settings.payhero_api_password
        self.account_id = settings.payhero_account_id

    def _auth_header(self) -> str:
        if not self.username or not self.password:
            raise ValueError("PayHero API credentials are not configured")
        token = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
        return f"Basic {token}"

    async def _request(self, method: str, path: str, **kwargs: Any) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = self._auth_header()
        headers.setdefault("Content-Type", "application/json")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            resp.raise_for_status()
            return resp.json()

    async def initiate_stk_push(
        self,
        amount: int,
        phone_number: str,
        channel_id: int,
        external_reference: str,
        customer_name: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "amount": amount,
            "phone_number": phone_number,
            "channel_id": channel_id,
            "provider": "m-pesa",
            "external_reference": external_reference,
        }
        if customer_name:
            payload["customer_name"] = customer_name
        if callback_url:
            payload["callback_url"] = callback_url
        return await self._request("POST", "/api/v2/payments", json=payload)

    async def get_transaction_status(self, reference: str) -> Dict[str, Any]:
        return await self._request("GET", f"/api/v2/transactions/{reference}")

    async def list_payment_channels(self) -> Dict[str, Any]:
        return await self._request("GET", "/api/v2/payment_channels")

    async def register_payment_channel(
        self,
        channel_type: str,
        short_code: str,
        account_number: str,
        description: str,
    ) -> Dict[str, Any]:
        if not self.account_id:
            raise ValueError("PayHero account_id is not configured")
        payload = {
            "channel_type": channel_type,
            "account_id": self.account_id,
            "short_code": short_code,
            "account_number": account_number,
            "description": description,
        }
        return await self._request("POST", "/api/v2/payment_channels", json=payload)

    async def get_account_transactions(self, reference: Optional[str] = None) -> Dict[str, Any]:
        params = {}
        if reference:
            params["reference"] = reference
        return await self._request("GET", "/api/v2/account/transactions", params=params)
