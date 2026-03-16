import os
from typing import Any

import httpx


class BackendApiError(RuntimeError):
    pass


class BackendClient:
    def __init__(self, base_url: str | None = None, timeout: float = 10.0):
        resolved_base_url = (
            base_url
            or os.getenv("BACKEND_API_URL")
            or os.getenv("API_SERVICE_URL")
            or "http://api:3000/api"
        ).rstrip("/")

        if not resolved_base_url.endswith("/api"):
            resolved_base_url = f"{resolved_base_url}/api"

        self.base_url = resolved_base_url
        self.timeout = timeout

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                body = exc.response.text
                raise BackendApiError(
                    f"Backend API request failed ({exc.response.status_code}) for {url}: {body}"
                ) from exc
            except httpx.HTTPError as exc:
                raise BackendApiError(f"Backend API unavailable for {url}: {exc}") from exc
