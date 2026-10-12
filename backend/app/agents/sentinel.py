import asyncio
from typing import Optional, List
from .base import BaseAgent, LogCallback
from ..models.schemas import OracleResult, SentinelResult, SourceRef
from ..tools.search import SearchTool, extract_domain


class SentinelAgent(BaseAgent):
    def __init__(self, **kwargs):
        super().__init__(name="sentinel", **kwargs)

    async def run(self, oracle: OracleResult, on_log: Optional[LogCallback] = None) -> SentinelResult:
        await self.log(on_log, "SENTINEL ONLINE — research engine engaged")
        await asyncio.sleep(0.08)
        kw_str = ", ".join(oracle.keywords[:3]) if oracle.keywords else oracle.claim[:30]
        await self.log(on_log, f"ANALYZING: {kw_str}")
        await asyncio.sleep(0.08)
        await self.log(on_log, "Formulating targeted verification search queries...")

        # 1. Generate targeted search queries
        query_prompt = (
            "You are SENTINEL's query generation module.\n"
            "Given a claim, generate 3 to 4 distinct, precise search queries that a fact-checker would use to verify or debunk it.\n"
            'Return a JSON object with a single key "queries" containing a list of strings.'
        )
        query_resp = await self.request_json(
            system_prompt=query_prompt,
            user_content=f'Claim: "{oracle.claim}"\nContext: {oracle.context}\nKeywords: {", ".join(oracle.keywords)}'
        )
        queries = [str(q) for q in query_resp.get("queries", []) if q]
        if not queries:
            queries = [
                f"{oracle.claim} fact check",
                f"{' '.join(oracle.keywords[:4])} news verification",
                f"is it true that {oracle.claim[:60]}"
            ]

        # 2. Execute live search for queries
        live_sources: List[SourceRef] = []
        snippets: List[str] = []

        for q in queries[:3]:
            await self.log(on_log, f'SEARCH: "{q}"')
            await asyncio.sleep(0.1)
            results = await SearchTool.search(q, max_results=3)
            for res in results:
                domain = res.get("domain", extract_domain(res.get("url", "")))
                live_sources.append(
                    SourceRef(
                        title=res.get("title", domain),
                        url=res.get("url", f"https://{domain}"),
                        domain=domain,
                        snippet=res.get("snippet", "")
                    )
                )
                if res.get("snippet"):
                    snippets.append(f"[{domain}] {res['snippet']}")

        is_grounded = len(live_sources) > 0
        if is_grounded:
            await self.log(on_log, f"Retrieved {len(live_sources)} live web sources from public index.")
        else:
            await self.log(on_log, "External search unavailable — falling back to parametric knowledge corpus.")

        # 3. Fact synthesis
        evidence_context = "\n".join(snippets[:8]) if snippets else "(No live search snippets retrieved; use parametric knowledge)"

        synthesis_prompt = (
            "You are SENTINEL, a rigorous investigative research agent in the TruthLens pipeline.\n"
            "Your job is to synthesize factual evidence about the claim using both the retrieved search evidence and your knowledge.\n"
            "Be precise, cite specific dates, figures, official bodies, or established consensus where known.\n"
            "Return valid JSON with keys:\n"
            '- "facts": array of 4 to 8 concise factual statements directly addressing the veracity of the claim\n'
            '- "sources": array of source objects (each with "title", "url", "domain")'
        )

        user_content = (
            f'Claim to verify: "{oracle.claim}"\n'
            f'Context: {oracle.context}\n'
            f'Search queries executed: {", ".join(queries)}\n\n'
            f'Live Evidence Snippets:\n{evidence_context}\n'
        )

        synthesis_resp = await self.request_json(
            system_prompt=synthesis_prompt,
            user_content=user_content
        )

        raw_facts = synthesis_resp.get("facts") or synthesis_resp.get("evidence") or []
        facts = []
        if isinstance(raw_facts, list):
            for f in raw_facts:
                if isinstance(f, dict):
                    facts.append(str(f.get("statement") or f.get("fact") or f.get("text") or list(f.values())[0]))
                else:
                    facts.append(str(f))
        elif isinstance(raw_facts, str):
            facts = [raw_facts]

        # Combine or deduplicate sources
        dedup_sources = {}
        for s in live_sources:
            if s.url not in dedup_sources:
                dedup_sources[s.url] = s

        # If model returned additional reputed sources, include up to 5 total
        model_sources = synthesis_resp.get("sources") or []
        if isinstance(model_sources, list):
            for ms in model_sources:
                if isinstance(ms, dict) and len(dedup_sources) < 6:
                    url = str(ms.get("url") or f"https://{ms.get('domain', 'source.com')}")
                    if url not in dedup_sources:
                        dom = str(ms.get("domain") or extract_domain(url))
                        dedup_sources[url] = SourceRef(
                            title=str(ms.get("title") or dom),
                            url=url,
                            domain=dom
                        )

        final_sources = list(dedup_sources.values())[:6]

        await self.log(on_log, f"{len(facts)} facts extracted · {len(final_sources)} sources identified")
        await self.log(on_log, "Cross-referencing source reputations & consensus...")

        return SentinelResult(
            facts=facts,
            sources=final_sources,
            queries=queries,
            grounded=is_grounded
        )
