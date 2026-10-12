import asyncio
from typing import Optional, List
from .base import BaseAgent, LogCallback
from ..models.schemas import OracleResult, SentinelResult, VerdictResult, VerdictLabel


class VerdictAgent(BaseAgent):
    def __init__(self, **kwargs):
        super().__init__(name="verdict", **kwargs)

    async def run(
        self,
        oracle: OracleResult,
        sentinel: SentinelResult,
        on_log: Optional[LogCallback] = None
    ) -> VerdictResult:
        await self.log(on_log, "VERDICT ONLINE — adjudication engine active")
        await asyncio.sleep(0.08)
        await self.log(on_log, "Weighing claim against retrieved evidence corpus...")
        await asyncio.sleep(0.08)
        await self.log(on_log, f"{len(sentinel.facts)} facts loaded · evaluating corroboration & contradictions")

        system_prompt = (
            "You are VERDICT, the final adjudicator of the TruthLens pipeline.\n"
            "Combine the extracted claim with the research findings and output a calibrated truth score.\n\n"
            "Scoring rubric:\n"
            "- 85–100: claim fully supported by credible evidence → TRUE\n"
            "- 70–84: largely supported with minor inaccuracies → MOSTLY TRUE\n"
            "- 40–69: mixed or partial support, significant nuance, or conflicting claims → PARTIALLY TRUE\n"
            "- 15–39: mostly contradicted, minor true kernel → MOSTLY FALSE\n"
            "- 0–14: contradicted or fabricated → FALSE\n"
            "- Missing or insufficient evidence to confirm/deny → UNVERIFIABLE (score 50 expressing neutral/uncertainty)\n\n"
            '"verdict" must be exactly one of: TRUE, MOSTLY TRUE, PARTIALLY TRUE, MOSTLY FALSE, FALSE, UNVERIFIABLE\n'
            '"corrections" must list specific factual corrections (empty array if none).\n'
            "Return valid JSON with keys: score (number), verdict (string), explanation (string), corrections (string[])."
        )

        user_content = (
            f"CLAIM: {oracle.claim}\n"
            f"CONTEXT: {oracle.context}\n"
            f"RESEARCH FACTS:\n"
            + "\n".join(f"- {f}" for f in sentinel.facts) if sentinel.facts else "(no research facts available)"
        )

        raw = await self.request_json(system_prompt=system_prompt, user_content=user_content)

        # Parse score
        raw_score = raw.get("score")
        try:
            score = int(float(raw_score))
        except (TypeError, ValueError):
            score = 50
        score = max(0, min(100, score))

        # Parse verdict label
        raw_verdict = str(raw.get("verdict", "")).upper().strip()
        allowed_verdicts: List[VerdictLabel] = [
            "TRUE",
            "MOSTLY TRUE",
            "PARTIALLY TRUE",
            "MOSTLY FALSE",
            "FALSE",
            "UNVERIFIABLE",
        ]

        verdict: VerdictLabel = "UNVERIFIABLE"
        for v in allowed_verdicts:
            if v in raw_verdict:
                verdict = v
                break

        explanation = str(raw.get("explanation") or raw.get("summary") or "Analysis complete.").strip()

        raw_corrections = raw.get("corrections") or []
        corrections = []
        if isinstance(raw_corrections, list):
            for c in raw_corrections:
                if isinstance(c, dict):
                    corrections.append(" ".join(str(v) for v in c.values()))
                elif c:
                    corrections.append(str(c))

        await self.log(on_log, f"ADJUDICATION COMPLETE — score {score}/100 [{verdict}]")

        return VerdictResult(
            score=score,
            verdict=verdict,
            explanation=explanation,
            corrections=corrections
        )
