import asyncio
from typing import Optional
from .base import BaseAgent, LogCallback
from ..models.schemas import OracleResult


class OracleAgent(BaseAgent):
    def __init__(self, **kwargs):
        super().__init__(name="oracle", **kwargs)

    async def run(self, input_text: str, on_log: Optional[LogCallback] = None) -> OracleResult:
        await self.log(on_log, "ORACLE ONLINE — claim extraction module initialized")
        await asyncio.sleep(0.08)
        await self.log(on_log, "Parsing semantic propositions & syntactic structure...")
        await asyncio.sleep(0.08)
        await self.log(on_log, "Isolating core proposition from conversational noise...")

        system_prompt = (
            "You are ORACLE, the first agent in the TruthLens verification pipeline.\n"
            "Your only job is to extract the single central claim from the user's input.\n"
            "Return a JSON object with exactly these fields:\n"
            '- "claim": string — the single core factual claim being made\n'
            '- "context": string — surrounding context that helps understand the claim\n'
            '- "keywords": string[] — 3 to 6 search keywords for fact-checking\n\n'
            "Do not evaluate truthfulness. Extraction only. Return valid JSON."
        )

        raw = await self.request_json(system_prompt=system_prompt, user_content=input_text)

        nested = raw.get("extraction") or raw.get("result") or raw.get("data") or {}
        if not isinstance(nested, dict):
            nested = {}

        claim = str(
            raw.get("claim")
            or nested.get("claim")
            or raw.get("statement")
            or nested.get("statement")
            or raw.get("core_claim")
            or input_text
        ).strip()

        context = str(
            raw.get("context")
            or nested.get("context")
            or raw.get("description")
            or ""
        ).strip()

        keywords = []
        raw_keywords = (
            raw.get("keywords")
            or nested.get("keywords")
            or raw.get("search_keywords")
            or nested.get("search_keywords")
        )
        if isinstance(raw_keywords, list):
            keywords = [str(k) for k in raw_keywords if k]
        elif isinstance(raw_keywords, str):
            keywords = [k.strip() for k in raw_keywords.split(",") if k.strip()]

        if not keywords:
            keywords = [w for w in claim.split()[:5] if len(w) > 3]

        result = OracleResult(claim=claim, context=context, keywords=keywords)

        await self.log(on_log, f'CLAIM ISOLATED: "{result.claim}"')
        await self.log(on_log, f'KEYWORDS: {", ".join(result.keywords[:4])}')
        await self.log(on_log, "Semantic fingerprint complete.")

        return result
