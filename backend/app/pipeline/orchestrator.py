import asyncio
import json
from typing import Optional, AsyncGenerator
from ..agents.oracle import OracleAgent
from ..agents.sentinel import SentinelAgent
from ..agents.verdict import VerdictAgent
from ..agents.base import LogCallback
from ..models.schemas import AnalyzeRequest, AnalysisResponse


class PipelineOrchestrator:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None
    ):
        self.api_key = api_key
        self.model = model
        self.temperature = temperature

        self.oracle = OracleAgent(api_key=api_key, model=model, temperature=temperature)
        self.sentinel = SentinelAgent(api_key=api_key, model=model, temperature=temperature)
        self.verdict = VerdictAgent(api_key=api_key, model=model, temperature=temperature)

    async def run(
        self,
        request: AnalyzeRequest,
        on_log: Optional[LogCallback] = None
    ) -> AnalysisResponse:
        # Step 1: ORACLE (Claim Extraction)
        oracle_res = await self.oracle.run(request.text, on_log=on_log)

        # Step 2: SENTINEL (Web Grounding & Fact Finding)
        sentinel_res = await self.sentinel.run(oracle_res, on_log=on_log)

        # Step 3: VERDICT (Adjudication & Truth Scoring)
        verdict_res = await self.verdict.run(oracle_res, sentinel_res, on_log=on_log)

        return AnalysisResponse(
            oracle=oracle_res,
            sentinel=sentinel_res,
            verdict=verdict_res
        )

    async def run_stream(self, request: AnalyzeRequest) -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[dict] = asyncio.Queue()

        async def queue_log(agent: str, line: str):
            await queue.put({"type": "log", "agent": agent, "line": line})

        async def worker():
            try:
                await queue.put({"type": "start", "agent": "oracle"})
                oracle_res = await self.oracle.run(request.text, on_log=queue_log)
                await queue.put({"type": "done", "agent": "oracle", "data": oracle_res.model_dump()})

                await queue.put({"type": "start", "agent": "sentinel"})
                sentinel_res = await self.sentinel.run(oracle_res, on_log=queue_log)
                await queue.put({"type": "done", "agent": "sentinel", "data": sentinel_res.model_dump()})

                await queue.put({"type": "start", "agent": "verdict"})
                verdict_res = await self.verdict.run(oracle_res, sentinel_res, on_log=queue_log)
                await queue.put({"type": "done", "agent": "verdict", "data": verdict_res.model_dump()})

                final_resp = AnalysisResponse(
                    oracle=oracle_res,
                    sentinel=sentinel_res,
                    verdict=verdict_res
                )
                await queue.put({"type": "complete", "result": final_resp.model_dump()})
            except Exception as e:
                await queue.put({"type": "error", "error": str(e)})
            finally:
                await queue.put({"type": "__end__"})

        task = asyncio.create_task(worker())

        while True:
            event = await queue.get()
            if event.get("type") == "__end__":
                break
            yield f"data: {json.dumps(event)}\n\n"

        await task
