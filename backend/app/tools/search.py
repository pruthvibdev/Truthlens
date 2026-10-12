import asyncio
import logging
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional

logger = logging.getLogger("truthlens.tools.search")


def extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path.split('/')[0]
        return domain.replace("www.", "")
    except Exception:
        return "source.com"


class SearchTool:
    """Live web search tool using DuckDuckGo Search with fallback resilience."""

    @classmethod
    async def search(cls, query: str, max_results: int = 4) -> List[Dict[str, str]]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls._sync_search, query, max_results)

    @classmethod
    def _sync_search(cls, query: str, max_results: int = 4) -> List[Dict[str, str]]:
        results = []
        try:
            # Attempt DDGS search
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS

            with DDGS() as ddgs:
                raw_results = list(ddgs.text(query, max_results=max_results))
                for r in raw_results:
                    title = r.get("title", "")
                    href = r.get("href", "") or r.get("link", "")
                    body = r.get("body", "") or r.get("snippet", "")
                    domain = extract_domain(href)
                    if href:
                        results.append({
                            "title": title or domain,
                            "url": href,
                            "domain": domain,
                            "snippet": body[:400]
                        })
            if results:
                return results
        except Exception as e:
            logger.warning(f"DuckDuckGo search error for '{query}': {e}. Using fallback.")

        # If live search fails (e.g. rate limit, offline), return empty or heuristic
        return results
