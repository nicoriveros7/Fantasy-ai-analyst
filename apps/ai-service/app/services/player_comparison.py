from statistics import mean
from typing import Any

from app.tools.fantasy_tools import FantasyTools


def _trend_label(values: list[float]) -> str:
    if len(values) < 2:
        return "stable"

    split = max(1, len(values) // 2)
    recent_window = values[:split]
    prior_window = values[split:]
    if not prior_window:
        return "stable"

    delta = mean(recent_window) - mean(prior_window)
    if delta > 0.05:
        return "up"
    if delta < -0.05:
        return "down"
    return "stable"


def _fixture_difficulty_from_matches(matches: list[dict[str, Any]]) -> float | None:
    difficulties: list[float] = []
    for item in matches:
        for key in ("fixtureDifficulty", "opponentDifficulty", "homeDifficulty", "awayDifficulty"):
            value = item.get(key)
            if isinstance(value, (int, float)):
                difficulties.append(float(value))
                break

    if not difficulties:
        return None

    return round(mean(difficulties), 3)


class PlayerComparisonService:
    def __init__(self, tools: FantasyTools):
        self.tools = tools

    async def compare_players(self, player_a: str, player_b: str, gameweek: int, last_n: int = 5) -> dict[str, Any]:
        stats_a = await self.tools.get_player_stats(player_a, last_n=last_n)
        stats_b = await self.tools.get_player_stats(player_b, last_n=last_n)

        data_a = stats_a.get("stats", {})
        data_b = stats_b.get("stats", {})

        matches_a = data_a.get("matches", []) if isinstance(data_a.get("matches"), list) else []
        matches_b = data_b.get("matches", []) if isinstance(data_b.get("matches"), list) else []

        xg_a = [float(match.get("xg", 0.0)) for match in matches_a]
        xg_b = [float(match.get("xg", 0.0)) for match in matches_b]
        xa_a = [float(match.get("xa", 0.0)) for match in matches_a]
        xa_b = [float(match.get("xa", 0.0)) for match in matches_b]

        minutes_a = [int(match.get("minutes", 0)) for match in matches_a]
        minutes_b = [int(match.get("minutes", 0)) for match in matches_b]

        avg_minutes_a = round(mean(minutes_a), 2) if minutes_a else 0.0
        avg_minutes_b = round(mean(minutes_b), 2) if minutes_b else 0.0

        reliability_a = round(sum(1 for value in minutes_a if value >= 60) / len(minutes_a), 3) if minutes_a else 0.0
        reliability_b = round(sum(1 for value in minutes_b if value >= 60) / len(minutes_b), 3) if minutes_b else 0.0

        form_score_a = float(data_a.get("formScore", 0.0))
        form_score_b = float(data_b.get("formScore", 0.0))

        fixture_difficulty_a = _fixture_difficulty_from_matches(matches_a)
        fixture_difficulty_b = _fixture_difficulty_from_matches(matches_b)

        xg_winner = "unknown"
        if xg_a and xg_b:
            xg_winner = "A" if mean(xg_a) >= mean(xg_b) else "B"

        xa_winner = "unknown"
        if xa_a and xa_b:
            xa_winner = "A" if mean(xa_a) >= mean(xa_b) else "B"

        fixture_winner = "unknown"
        if fixture_difficulty_a is not None and fixture_difficulty_b is not None:
            fixture_winner = "A" if fixture_difficulty_a <= fixture_difficulty_b else "B"

        winner_by_metric = {
            "formScore": "A" if form_score_a >= form_score_b else "B",
            "xgTrend": xg_winner,
            "xaTrend": xa_winner,
            "minutesReliability": "A" if reliability_a >= reliability_b else "B",
            "fixtureDifficulty": fixture_winner,
        }

        return {
            "gameweek": gameweek,
            "playerA": {
                "name": stats_a.get("resolvedPlayer", {}).get("displayName", player_a),
                "formScore": round(form_score_a, 3),
                "xgTrend": _trend_label(xg_a),
                "xaTrend": _trend_label(xa_a),
                "minutesReliability": reliability_a,
                "averageMinutes": avg_minutes_a,
                "fixtureDifficulty": fixture_difficulty_a,
            },
            "playerB": {
                "name": stats_b.get("resolvedPlayer", {}).get("displayName", player_b),
                "formScore": round(form_score_b, 3),
                "xgTrend": _trend_label(xg_b),
                "xaTrend": _trend_label(xa_b),
                "minutesReliability": reliability_b,
                "averageMinutes": avg_minutes_b,
                "fixtureDifficulty": fixture_difficulty_b,
            },
            "winnerByMetric": winner_by_metric,
            "notes": {
                "fixtureDifficultyAvailable": fixture_difficulty_a is not None and fixture_difficulty_b is not None,
                "source": "deterministic-comparison",
            },
        }
