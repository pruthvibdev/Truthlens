import time
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from .config import settings
from .models.schemas import (
    AnalyzeRequest,
    AnalysisResponse,
    TestConnectionRequest,
    TestConnectionResponse,
)
from .pipeline.orchestrator import PipelineOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("truthlens.api")

app = FastAPI(
    title="TruthLens Agentic Fact-Checking Engine",
    description="Multi-agent NLP pipeline (ORACLE, SENTINEL, VERDICT) for automated claim verification and credibility scoring.",
    version="1.0.0"
)

# Enable CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "TruthLens Backend",
        "status": "online",
        "version": "1.0.0",
        "pipeline": ["ORACLE (Claim Extraction)", "SENTINEL (Live Web Grounding)", "VERDICT (Truth Adjudication)"]
    }


@app.get("/health")
def health():
    return {"status": "ok", "groq_configured": bool(settings.GROQ_API_KEY)}


@app.post("/api/test-connection", response_model=TestConnectionResponse)
async def test_connection(req: TestConnectionRequest):
    t0 = time.perf_counter()
    api_key = req.api_key or settings.GROQ_API_KEY
    if not api_key:
        return TestConnectionResponse(
            success=False,
            message="No API key provided or configured on server."
        )

    model = req.model or settings.GROQ_MODEL
    try:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=2
        )
        latency = int((time.perf_counter() - t0) * 1000)
        return TestConnectionResponse(
            success=True,
            message="Connected to Groq API successfully",
            latency_ms=latency
        )
    except Exception as e:
        return TestConnectionResponse(
            success=False,
            message=f"Connection failed: {str(e)}"
        )


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_claim(req: AnalyzeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")

    try:
        orchestrator = PipelineOrchestrator(
            api_key=req.api_key,
            model=req.model,
            temperature=req.temperature
        )
        result = await orchestrator.run(req)
        return result
    except Exception as e:
        logger.exception("Pipeline execution failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze/stream")
async def analyze_claim_stream(req: AnalyzeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty.")

    orchestrator = PipelineOrchestrator(
        api_key=req.api_key,
        model=req.model,
        temperature=req.temperature
    )
    return StreamingResponse(
        orchestrator.run_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
