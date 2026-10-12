from typing import List, Optional, Literal
from pydantic import BaseModel, Field

InputMode = Literal['text', 'url', 'image']
AgentId = Literal['oracle', 'sentinel', 'verdict']
AgentStatus = Literal['idle', 'processing', 'done', 'error']

VerdictLabel = Literal[
    'TRUE',
    'MOSTLY TRUE',
    'PARTIALLY TRUE',
    'MOSTLY FALSE',
    'FALSE',
    'UNVERIFIABLE'
]


class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="The statement, extracted OCR text, or webpage body to verify")
    mode: InputMode = Field(default="text", description="Input type: text, url, or image")
    api_key: Optional[str] = Field(default=None, description="Optional Groq API key override")
    model: Optional[str] = Field(default=None, description="Optional model override")
    temperature: Optional[float] = Field(default=None, description="Optional temperature override")


class OracleResult(BaseModel):
    claim: str = Field(..., description="Isolated atomic claim")
    context: str = Field(default="", description="Relevant surrounding context")
    keywords: List[str] = Field(default_factory=list, description="Targeted keywords for search")


class SourceRef(BaseModel):
    title: str
    url: str
    domain: str
    snippet: Optional[str] = None


class SentinelResult(BaseModel):
    facts: List[str] = Field(default_factory=list, description="Extracted factual evidence")
    sources: List[SourceRef] = Field(default_factory=list, description="Identified or scraped sources")
    queries: List[str] = Field(default_factory=list, description="Search queries executed")
    grounded: bool = Field(default=False, description="Whether live search grounding was performed")


class VerdictResult(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Truth score 0 to 100")
    verdict: VerdictLabel = Field(..., description="Categorical verdict label")
    explanation: str = Field(..., description="Detailed adjudication rationale")
    corrections: List[str] = Field(default_factory=list, description="Specific factual corrections")


class AnalysisResponse(BaseModel):
    oracle: OracleResult
    sentinel: SentinelResult
    verdict: VerdictResult


class TestConnectionRequest(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
