import asyncio
from typing import Any

from app.tools.backend_client import BackendApiError, BackendClient


class ToolInputError(ValueError):
    pass


class FantasyTools:
    def __init__(self, client: BackendClient | None = None):
        self.client = client or BackendClient()

    async def resolve_player_by_name(self, player_name: str) -> dict[str, Any]:
        query = player_name.strip()
        if not query:
            raise ToolInputError("player_name is required")

        result = await self.client.get("/players", params={"q": query, "limit": 10, "page": 1})
        items = result.get("items", []) if isinstance(result, dict) else []
        if not items:
            raise ToolInputError(f"No player found for '{player_name}'")

        lower_query = query.lower()
        exact = next(
            (
                player
                for player in items
                if str(player.get("displayName", "")).lower() == lower_query
                or f"{player.get('firstName', '')} {player.get('lastName', '')}".strip().lower()
                == lower_query
            ),
            None,
        )
        return exact or items[0]

    async def get_player_stats(self, player_name: str, last_n: int = 5) -> dict[str, Any]:
        player = await self.resolve_player_by_name(player_name)
        player_id = player.get("id")
        if not player_id:
            raise BackendApiError("Resolved player does not contain id")

        stats = await self.client.get(f"/players/{player_id}/stats", params={"lastN": last_n})
        return {
            "resolvedPlayer": {
                "id": player.get("id"),
                "displayName": player.get("displayName"),
                "team": player.get("team", {}).get("shortName") if isinstance(player.get("team"), dict) else None,
            },
            "stats": stats,
        }

    async def compare_players(self, player_a: str, player_b: str, gameweek: int) -> dict[str, Any]:
        # Deferred import avoids a circular dependency at module import time.
        from app.services.player_comparison import PlayerComparisonService

        service = PlayerComparisonService(self)
        return await service.compare_players(player_a=player_a, player_b=player_b, gameweek=gameweek)

    async def get_captain_recommendations(self, gameweek: int, limit: int = 5) -> dict[str, Any]:
        return await self.client.get("/recommendations/captains", params={"gameweek": gameweek, "limit": limit})

    async def get_differential_recommendations(self, gameweek: int, limit: int = 5) -> dict[str, Any]:
        return await self.client.get(
            "/recommendations/differentials", params={"gameweek": gameweek, "limit": limit}
        )

    async def get_transfer_recommendations(self, gameweek: int, limit: int = 5) -> dict[str, Any]:
        return await self.client.get("/recommendations/transfers", params={"gameweek": gameweek, "limit": limit})

    async def get_player_by_id(self, player_id: int) -> dict[str, Any]:
        return await self.client.get(f"/players/{player_id}")

    async def get_differential_recommendations_under_budget(
        self, gameweek: int, max_price: float, limit: int = 5
    ) -> dict[str, Any]:
        if max_price <= 0:
            raise ToolInputError("max_price must be greater than zero")

        base = await self.get_differential_recommendations(gameweek=gameweek, limit=max(10, limit * 4))
        items = base.get("items", []) if isinstance(base, dict) else []

        async def enrich(item: dict[str, Any]) -> dict[str, Any]:
            player_id = item.get("playerId")
            if not isinstance(player_id, int):
                return item

            try:
                player = await self.get_player_by_id(player_id)
                price = float(player.get("price", 0.0))
                if price > max_price:
                    return {}

                return {
                    **item,
                    "player": {
                        "id": player.get("id"),
                        "displayName": player.get("displayName"),
                        "team": player.get("team", {}).get("shortName")
                        if isinstance(player.get("team"), dict)
                        else None,
                        "price": price,
                    },
                }
            except BackendApiError:
                return {}

        enriched = await asyncio.gather(*(enrich(item) for item in items))
        filtered = [item for item in enriched if item]

        return {
            "type": "differential",
            "gameweek": gameweek,
            "maxPrice": max_price,
            "items": filtered[:limit],
        }

    async def get_fixture_insights(self, gameweek: int, limit: int = 5) -> dict[str, Any]:
        captain_data, transfer_data = await asyncio.gather(
            self.get_captain_recommendations(gameweek=gameweek, limit=max(8, limit * 2)),
            self.get_transfer_recommendations(gameweek=gameweek, limit=max(8, limit * 2)),
        )

        merged = [
            *(captain_data.get("items", []) if isinstance(captain_data, dict) else []),
            *(transfer_data.get("items", []) if isinstance(transfer_data, dict) else []),
        ]

        dedup: dict[int, dict[str, Any]] = {}
        for item in merged:
            player_id = item.get("playerId")
            if not isinstance(player_id, int):
                continue

            fixture_score = float(item.get("signals", {}).get("fixtureScore", 0.0))
            current = dedup.get(player_id)
            if not current or fixture_score > float(current.get("signals", {}).get("fixtureScore", 0.0)):
                dedup[player_id] = item

        ranked = sorted(
            dedup.values(),
            key=lambda item: float(item.get("signals", {}).get("fixtureScore", 0.0)),
            reverse=True,
        )

        return {
            "type": "fixture_insights",
            "gameweek": gameweek,
            "items": ranked[:limit],
            "sourceTools": ["get_captain_recommendations", "get_transfer_recommendations"],
        }
