import json
import logging
from typing import Callable, Awaitable, Optional, Any, Dict
from openai import AsyncOpenAI
from ..config import settings

logger = logging.getLogger("truthlens.agents")
LogCallback = Callable[[str, str], Awaitable[None]]


class BaseAgent:
    def __init__(
        self,
        name: str,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None
    ):
        self.name = name
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL
        self.temperature = temperature if temperature is not None else settings.DEFAULT_TEMPERATURE

        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not configured")

        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.groq.com/openai/v1"
        )

    async def log(self, on_log: Optional[LogCallback], message: str):
        logger.info(f"[{self.name.upper()}] {message}")
        if on_log:
            try:
                await on_log(self.name, message)
            except Exception as e:
                logger.warning(f"Error in on_log callback: {e}")

    def _parse_json(self, raw_text: str) -> Dict[str, Any]:
        cleaned = raw_text.replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(cleaned[start : end + 1])
            raise ValueError(f"Failed to parse valid JSON from response: {raw_text[:200]}")

    async def request_json(
        self,
        system_prompt: str,
        user_content: str,
        max_tokens: int = 1500
    ) -> Dict[str, Any]:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=self.temperature,
            max_tokens=max_tokens
        )
        content = response.choices[0].message.content or "{}"
        return self._parse_json(content)
