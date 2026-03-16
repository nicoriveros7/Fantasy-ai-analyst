import re
from typing import Any

from app.schemas.ask import AskResponse
from app.services.llm_service import LlmService
from app.tools.fantasy_tools import FantasyTools, ToolInputError


class QuestionOrchestrator:
    def __init__(self, tools: FantasyTools | None = None, llm_service: LlmService | None = None):
        self.tools = tools or FantasyTools()
        self.llm = llm_service or LlmService()

    async def ask(self, question: str) -> AskResponse:
        normalized = question.strip()
        if not normalized:
            raise ToolInputError("question is required")

        lowered = normalized.lower()
        gameweek = self._extract_gameweek(normalized)
        used_tools: list[str] = []
        context: dict[str, Any] = {
            "question": normalized,
            "gameweek": gameweek,
        }

        intent = {
            "isComparison": self._looks_like_comparison(lowered),
            "isCaptain": self._mentions_captain(lowered),
            "isDifferential": self._mentions_differential(lowered),
            "isTransfer": self._mentions_transfer(lowered),
            "isStats": self._mentions_stats(lowered),
            "isBench": self._mentions_benching(lowered),
            "isFixtureOnly": self._mentions_fixture_focus(lowered),
        }
        context["intent"] = intent

        budget = self._extract_budget(normalized)
        if budget is not None:
            context["constraints"] = {"maxPrice": budget}

        def mark_tool(tool_name: str):
            if tool_name not in used_tools:
                used_tools.append(tool_name)

        if intent["isComparison"]:
            player_a, player_b = self._extract_two_players(normalized)
            if player_a and player_b:
                comparison = await self.tools.compare_players(player_a, player_b, gameweek)
                context["comparison"] = comparison
                mark_tool("compare_players")

                if intent["isBench"]:
                    bench_player = self._select_bench_player(comparison)
                    context["benchingAdvice"] = {
                        "action": "bench",
                        "player": bench_player,
                        "reason": "Lower deterministic profile based on form, trends, and minutes reliability.",
                    }

        if intent["isCaptain"]:
            context["captainRecommendations"] = await self.tools.get_captain_recommendations(gameweek, limit=5)
            mark_tool("get_captain_recommendations")

        if intent["isDifferential"]:
            if budget is not None:
                context["differentialRecommendations"] = (
                    await self.tools.get_differential_recommendations_under_budget(
                        gameweek=gameweek,
                        max_price=budget,
                        limit=5,
                    )
                )
                mark_tool("get_differential_recommendations_under_budget")
            else:
                context["differentialRecommendations"] = await self.tools.get_differential_recommendations(
                    gameweek, limit=5
                )
                mark_tool("get_differential_recommendations")

        if intent["isTransfer"]:
            context["transferRecommendations"] = await self.tools.get_transfer_recommendations(gameweek, limit=5)
            mark_tool("get_transfer_recommendations")

        if intent["isFixtureOnly"]:
            context["fixtureInsights"] = await self.tools.get_fixture_insights(gameweek=gameweek, limit=5)
            mark_tool("get_fixture_insights")

        if intent["isStats"]:
            player_name = self._extract_single_player(normalized)
            if player_name:
                context["playerStats"] = await self.tools.get_player_stats(player_name, last_n=5)
                mark_tool("get_player_stats")

        if not used_tools:
            context["captainRecommendations"] = await self.tools.get_captain_recommendations(gameweek, limit=3)
            mark_tool("get_captain_recommendations")

        answer = await self.llm.generate_answer(normalized, context)
        confidence = self._calculate_confidence(used_tools, llm_enabled=self.llm.enabled)

        return AskResponse(
            answer=answer,
            confidence=confidence,
            usedTools=used_tools,
            structuredContext=context,
        )

    def _extract_gameweek(self, question: str) -> int:
        match = re.search(r"gameweek\s*(\d+)", question, re.IGNORECASE)
        if match:
            return max(1, int(match.group(1)))
        return 1

    def _extract_two_players(self, question: str) -> tuple[str | None, str | None]:
        patterns = [
            r"captain\s+([A-Za-z .'-]+?)\s+or\s+([A-Za-z .'-]+?)(?:\s+in\s+gameweek|\?|$)",
            r"([A-Za-z .'-]+?)\s+or\s+([A-Za-z .'-]+?)(?:\s+in\s+gameweek|\?|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, question, re.IGNORECASE)
            if match:
                return match.group(1).strip(), match.group(2).strip()
        return None, None

    def _extract_single_player(self, question: str) -> str | None:
        match = re.search(r"(?:stats|form)\s+(?:for\s+)?([A-Za-z .'-]+?)(?:\s+in\s+gameweek|\?|$)", question, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None

    def _looks_like_comparison(self, question: str) -> bool:
        return " or " in question or "compare" in question

    def _mentions_captain(self, question: str) -> bool:
        return "captain" in question

    def _mentions_differential(self, question: str) -> bool:
        return "differential" in question

    def _mentions_transfer(self, question: str) -> bool:
        return "transfer" in question

    def _mentions_stats(self, question: str) -> bool:
        return "stats" in question or "form" in question

    def _mentions_benching(self, question: str) -> bool:
        return "bench" in question or "start" in question or "sit" in question

    def _mentions_fixture_focus(self, question: str) -> bool:
        fixture_words = ("fixture", "fixtures", "easy run", "easiest run")
        asks_for_fixture = any(word in question for word in fixture_words)
        asks_other_primary = any(
            word in question for word in ("captain", "differential", "transfer", "stats", "form")
        )
        return asks_for_fixture and not asks_other_primary

    def _extract_budget(self, question: str) -> float | None:
        patterns = [
            r"(?:under|below|less than|<=?)\s*[£$]?\s*(\d+(?:\.\d+)?)",
            r"budget\s*[£$]?\s*(\d+(?:\.\d+)?)",
        ]

        for pattern in patterns:
            match = re.search(pattern, question, re.IGNORECASE)
            if match:
                return float(match.group(1))

        return None

    def _select_bench_player(self, comparison: dict[str, Any]) -> str:
        player_a = comparison.get("playerA", {})
        player_b = comparison.get("playerB", {})

        score_a = (
            float(player_a.get("formScore", 0.0))
            + float(player_a.get("minutesReliability", 0.0))
            + (0.15 if player_a.get("xgTrend") == "up" else 0.0)
            + (0.1 if player_a.get("xaTrend") == "up" else 0.0)
        )
        score_b = (
            float(player_b.get("formScore", 0.0))
            + float(player_b.get("minutesReliability", 0.0))
            + (0.15 if player_b.get("xgTrend") == "up" else 0.0)
            + (0.1 if player_b.get("xaTrend") == "up" else 0.0)
        )

        return str(player_a.get("name", "Player A")) if score_a < score_b else str(player_b.get("name", "Player B"))

    def _calculate_confidence(self, used_tools: list[str], llm_enabled: bool) -> float:
        base = 0.55 if llm_enabled else 0.45
        lift = min(0.35, len(set(used_tools)) * 0.1)
        return round(min(0.95, base + lift), 3)
