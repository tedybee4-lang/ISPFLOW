import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.rate_limit import enforce
from app.core.redis import redis_client


class CountingRedis:
    def __init__(self):
        self.count = 0

    async def eval(self, script, key_count, key, limit, window_ms):
        self.count += 1
        if self.count > limit:
            return 125000
        return -1


@pytest.mark.asyncio
async def test_rate_limit_rejects_attempts_after_configured_limit(monkeypatch):
    redis = CountingRedis()
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setattr(redis_client, "redis", redis)

    await enforce("test:identifier", limit=2, window_seconds=300)
    await enforce("test:identifier", limit=2, window_seconds=300)

    with pytest.raises(HTTPException) as error:
        await enforce("test:identifier", limit=2, window_seconds=300)

    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"] == "125"
