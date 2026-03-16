import os
from typing import Any

import httpx


class LlmService:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def generate_answer(self, question: str, context: dict[str, Any]) -> str:
        if not self.enabled:
            return self._fallback_answer(question, context)

        system_prompt = (
            "You are a fantasy football assistant. Use only provided context. "
            "Be explicit about uncertainty. Keep the answer concise and actionable."
        )
        user_prompt = (
            f"Question: {question}\n\n"
            f"Structured context (JSON): {context}\n\n"
            "Return only the final answer text for the user."
        )

        payload = {
            "model": self.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                body = response.json()
            except httpx.HTTPError:
                return self._fallback_answer(question, context)

        choices = body.get("choices", [])
        if not choices:
            return self._fallback_answer(question, context)

        message = choices[0].get("message", {})
        content = message.get("content")
        return str(content).strip() if content else self._fallback_answer(question, context)

    def _fallback_answer(self, question: str, context: dict[str, Any]) -> str:
        if comparison := context.get("comparison"):
            player_a = comparison.get("playerA", {}).get("name", "Player A")
            player_b = comparison.get("playerB", {}).get("name", "Player B")
            form_a = comparison.get("playerA", {}).get("formScore", 0)
            form_b = comparison.get("playerB", {}).get("formScore", 0)
            preferred = player_a if form_a >= form_b else player_b
            return (
                f"Based on current backend metrics, {preferred} edges the comparison over "
                f"{player_b if preferred == player_a else player_a}. "
                "This recommendation is deterministic because no LLM key is configured."
            )

        return (
            "I gathered the relevant backend context, but a full natural-language synthesis "
            "requires an OPENAI_API_KEY. Please configure it to enable richer responses."
        )
