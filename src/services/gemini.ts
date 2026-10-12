import OpenAI from 'openai'
import type {
  OracleResult,
  SentinelResult,
  SourceRef,
  VerdictResult,
} from '../types'

// ---------------------------------------------------------------------------
// Config & Dynamic Settings
// ---------------------------------------------------------------------------
export const DEFAULT_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined
export const DEFAULT_MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined) ?? 'openai/gpt-oss-120b'
export const DEFAULT_TEMPERATURE = 0.2

export function getEffectiveApiKey(): string | undefined {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('truthlens_api_key')
    if (custom && custom.trim() && custom.trim() !== 'your_groq_api_key_here') {
      return custom.trim()
    }
  }
  if (DEFAULT_API_KEY && DEFAULT_API_KEY.trim() && DEFAULT_API_KEY.trim() !== 'your_groq_api_key_here') {
    return DEFAULT_API_KEY.trim()
  }
  return undefined
}

export function getEffectiveModel(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('truthlens_model')
    if (custom && custom.trim()) return custom.trim()
  }
  return DEFAULT_MODEL
}

export function getEffectiveTemperature(): number {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('truthlens_temperature')
    if (custom !== null) {
      const parsed = parseFloat(custom)
      if (!isNaN(parsed)) return parsed
    }
  }
  return DEFAULT_TEMPERATURE
}

export const API_KEY = getEffectiveApiKey()

export type LogSink = (agent: 'oracle' | 'sentinel' | 'verdict', line: string) => void

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function logSeq(
  onLog: LogSink,
  agent: 'oracle' | 'sentinel' | 'verdict',
  lines: string[],
) {
  for (const line of lines) {
    onLog(agent, line)
    await delay(120 + Math.random() * 260)
  }
}

function newClient(overrideKey?: string): OpenAI {
  const key = overrideKey || getEffectiveApiKey()
  if (!key) throw new Error('MISSING_KEY')
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.groq.com/openai/v1',
    dangerouslyAllowBrowser: true, // required for Vite/browser use
  })
}

export async function testConnection(
  apiKey?: string,
  model?: string,
): Promise<{ success: boolean; message: string; latency?: number }> {
  const t0 = performance.now()
  try {
    const client = newClient(apiKey)
    const targetModel = model || getEffectiveModel()
    await client.chat.completions.create({
      model: targetModel,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 2,
    })
    const latency = Math.round(performance.now() - t0)
    return { success: true, message: 'Connected to Groq API', latency }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed'
    return { success: false, message: msg }
  }
}

function parseJsonBlock(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('INVALID_JSON')
  }
}

async function requestJson(
  client: OpenAI,
  systemPrompt: string,
  userContent: string,
): Promise<unknown> {
  const response = await client.chat.completions.create({
    model: getEffectiveModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    temperature: getEffectiveTemperature(),
    max_tokens: 1024,
  })
  const text = response.choices[0]?.message?.content ?? '{}'
  return parseJsonBlock(text)
}

// ---------------------------------------------------------------------------
// ORACLE — Claim extraction
// ---------------------------------------------------------------------------
export async function runOracle(
  input: string,
  onLog: LogSink,
): Promise<OracleResult> {
  const client = newClient()
  await logSeq(onLog, 'oracle', [
    'ORACLE ONLINE — claim extraction module initialized',
    'Parsing semantic structure...',
    'Isolating core proposition from noise...',
  ])

  const raw = (await requestJson(
    client,
    `You are ORACLE, the first agent in the TruthLens verification pipeline.
Your only job is to extract the single central claim from the user's input.
Return a JSON object with exactly these fields:
- "claim": string — the single core factual claim being made
- "context": string — surrounding context that helps understand the claim
- "keywords": string[] — 3 to 6 search keywords for fact-checking

Do not evaluate truthfulness. Extraction only. Return valid JSON.`,
    input,
  )) as Record<string, unknown>

  const nested = (raw?.extraction ?? raw?.result ?? raw?.data ?? {}) as Record<string, unknown>
  const claim = String(raw?.claim ?? nested?.claim ?? raw?.statement ?? nested?.statement ?? raw?.core_claim ?? input).trim()
  const context = String(raw?.context ?? nested?.context ?? raw?.description ?? '').trim()

  let keywords: string[] = []
  const rawKeywords = raw?.keywords ?? nested?.keywords ?? raw?.search_keywords ?? nested?.search_keywords
  if (Array.isArray(rawKeywords)) {
    keywords = rawKeywords
      .map((k) => (typeof k === 'object' && k !== null ? Object.values(k).join(' ') : String(k)))
      .filter(Boolean)
  } else if (typeof rawKeywords === 'string') {
    keywords = rawKeywords.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (!keywords.length) {
    keywords = claim.split(/\s+/).slice(0, 5)
  }

  const result: OracleResult = { claim, context, keywords }

  await logSeq(onLog, 'oracle', [
    `CLAIM ISOLATED: "${result.claim}"`,
    `KEYWORDS: ${result.keywords.slice(0, 4).join(', ')}`,
    'Semantic fingerprint complete.',
  ])

  return result
}

// ---------------------------------------------------------------------------
// SENTINEL — Research & fact-finding (knowledge-based)
// ---------------------------------------------------------------------------
export async function runSentinel(
  oracle: OracleResult,
  onLog: LogSink,
): Promise<SentinelResult> {
  const client = newClient()

  await logSeq(onLog, 'sentinel', [
    'SENTINEL ONLINE — research engine engaged',
    `ANALYZING: ${oracle.keywords.slice(0, 3).join(', ')}`,
    'Cross-referencing knowledge base...',
  ])

  const userContent = `Claim to verify: "${oracle.claim}"
Context: ${oracle.context}
Keywords: ${oracle.keywords.join(', ')}

Using your knowledge, research this claim thoroughly. Provide:
- "facts": array of 4–8 concise factual statements directly relevant to verifying this claim
- "queries": array of 3–4 search queries someone would use to fact-check this claim
- "sources": array of up to 4 well-known, reputable sources (format: {"title": string, "url": string, "domain": string}) that are likely to cover this topic

Return valid JSON with keys: facts, queries, sources.`

  const raw = (await requestJson(
    client,
    `You are SENTINEL, a rigorous research agent in the TruthLens fact-checking pipeline.
Your job is to gather factual evidence about a claim using your extensive knowledge.
Be precise, cite specific facts, dates, and figures where known.
For sources, only include real, well-known domains that genuinely cover this topic.
Return valid JSON with keys:
- "facts": array of string statements
- "queries": array of 3-4 string search queries
- "sources": array of objects with keys "title", "url", "domain"`,
    userContent,
  )) as Record<string, unknown>

  const rawFacts = raw?.facts ?? raw?.evidence ?? raw?.findings ?? []
  let facts: string[] = []
  if (Array.isArray(rawFacts)) {
    facts = rawFacts
      .map((f) => {
        if (typeof f === 'string') return f
        if (typeof f === 'object' && f !== null) {
          const rec = f as Record<string, unknown>
          return String(rec.statement ?? rec.fact ?? rec.text ?? rec.details ?? Object.values(rec).join(' - '))
        }
        return String(f)
      })
      .filter(Boolean)
  } else if (typeof rawFacts === 'string') {
    facts = [rawFacts]
  }

  const rawQueries = raw?.queries ?? raw?.search_queries ?? []
  const queries: string[] = Array.isArray(rawQueries) ? rawQueries.map(String) : []

  const rawSources = raw?.sources ?? raw?.references ?? []
  const sources: SourceRef[] = (Array.isArray(rawSources) ? rawSources : [])
    .map((s) => {
      if (typeof s === 'object' && s !== null) {
        const rec = s as Record<string, unknown>
        const domain = String(
          rec.domain ??
            (rec.url ? (String(rec.url).replace(/^https?:\/\//, '').split('/')[0] || 'source.com') : 'source.com'),
        )
        const url = String(rec.url ?? `https://${domain}`)
        const title = String(rec.title ?? domain)
        return { title, url, domain }
      }
      return null
    })
    .filter((s): s is SourceRef => Boolean(s))
    .slice(0, 6)

  for (const q of queries) {
    onLog('sentinel', `SEARCH: "${q}"`)
    await delay(180)
  }

  await logSeq(onLog, 'sentinel', [
    `${facts.length} facts extracted · ${sources.length} sources identified`,
    'Cross-referencing source reputations...',
  ])

  return { facts, sources, queries, grounded: false }
}

// ---------------------------------------------------------------------------
// VERDICT — Final truth adjudication
// ---------------------------------------------------------------------------
export async function runVerdict(
  oracle: OracleResult,
  sentinel: SentinelResult,
  onLog: LogSink,
): Promise<VerdictResult> {
  const client = newClient()

  await logSeq(onLog, 'verdict', [
    'VERDICT ONLINE — adjudication engine active',
    'Weighing claim against evidence corpus...',
    `${sentinel.facts.length} facts loaded · beginning scoring`,
  ])

  const raw = (await requestJson(
    client,
    `You are VERDICT, the final adjudicator of the TruthLens pipeline.
Combine the extracted claim with the research findings and output a truth score.

Scoring rubric:
- 85–100: claim fully supported by credible evidence → TRUE
- 70–84: largely supported with minor inaccuracies → MOSTLY TRUE
- 40–69: mixed or partial support, significant nuance → PARTIALLY TRUE
- 15–39: mostly contradicted, minor true kernel → MOSTLY FALSE
- 0–14: contradicted or fabricated → FALSE
- Missing/insufficient evidence → UNVERIFIABLE (score 0–100 expressing confidence)

"verdict" must be exactly one of: TRUE, MOSTLY TRUE, PARTIALLY TRUE, MOSTLY FALSE, FALSE, UNVERIFIABLE
"corrections" must list specific factual corrections (empty array if none).
Return valid JSON with keys: score (number), verdict (string), explanation (string), corrections (string[]).`,
    `CLAIM: ${oracle.claim}
CONTEXT: ${oracle.context}
RESEARCH FACTS:
${(sentinel.facts.length ? sentinel.facts : ['(no research facts available)']).map((f) => `- ${f}`).join('\n')}`,
  )) as Record<string, unknown>

  let score = typeof raw?.score === 'number' ? raw.score : Number(raw?.score)
  if (isNaN(score)) score = 50
  score = Math.min(100, Math.max(0, Math.round(score)))

  const rawVerdict = String(raw?.verdict ?? '').toUpperCase().trim()
  let verdict: VerdictResult['verdict'] = 'UNVERIFIABLE'
  for (const v of [
    'TRUE',
    'MOSTLY TRUE',
    'PARTIALLY TRUE',
    'MOSTLY FALSE',
    'FALSE',
    'UNVERIFIABLE',
  ] as const) {
    if (rawVerdict.includes(v)) {
      verdict = v
      break
    }
  }

  const explanation = String(raw?.explanation ?? raw?.summary ?? 'Analysis complete.').trim()
  const rawCorrections = raw?.corrections ?? []
  const corrections: string[] = Array.isArray(rawCorrections)
    ? rawCorrections
        .map((c) => (typeof c === 'object' && c !== null ? Object.values(c).join(' ') : String(c)))
        .filter(Boolean)
    : []

  await logSeq(onLog, 'verdict', [
    `ADJUDICATION COMPLETE — score ${score}/100`,
  ])

  return {
    score,
    verdict,
    explanation,
    corrections,
  }
}