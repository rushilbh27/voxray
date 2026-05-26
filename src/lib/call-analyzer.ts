/**
 * Unified call analysis entry point.
 *
 * Primary:     Claude Haiku — synchronous, highly accurate rule-based error detection
 * Enrichment:  Llama 3.2 (self-hosted audio) — async, adds raw_transcript + customer/agent names
 *
 * Llama is NOT used for error detection — it misses errors consistently.
 * Llama results arrive via /api/webhook/transcript and store enrichment only.
 *
 * Prompt versioning: agent's system prompt is SHA-256 hashed and stored per call,
 * enabling error-rate-by-prompt-version tracking in the dashboard.
 */
import { createHash } from 'crypto';
import { queueAudioAnalysis } from './audio-analyzer';
import { analyzeCallErrors, detectAgentType } from './error-analyzer';
import type { ErrorAnalysis } from './error-analyzer';
import { fetchAgent } from './ultravox';

export interface AnalyzeResult {
  analysis: ErrorAnalysis;
  enrichment_queued: boolean;
  prompt_hash?: string; // SHA-256 of the agent's system prompt at analysis time
  haiku_failed?: boolean; // true = Haiku unavailable, Llama fallback in progress
}

const EMPTY_ANALYSIS: ErrorAnalysis = {
  errors: [],
  goal_achieved: false,
  goal_outcome: 'unknown',
  missed_opportunities: [],
  summary: 'Analysis pending — AI provider unavailable, Llama fallback in progress.',
  error_count: 0,
  critical_error_count: 0,
};

interface AnalyzeCallOptions {
  callId: string;
  agentId?: string | null;
  clientName: string;
  messages: Array<{ role: string; text: string; ordinal: number }>;
  webhookUrl: string;
}

export async function analyzeCall(opts: AnalyzeCallOptions): Promise<AnalyzeResult> {
  const { callId, agentId, clientName, messages, webhookUrl } = opts;

  // ── Compute prompt hash if agent ID is known ────────────────────────────────
  let promptHash: string | undefined;
  let agentPrompt: string | undefined;
  if (agentId) {
    const agent = await fetchAgent(agentId).catch(() => null);
    if (agent?.systemPrompt) {
      agentPrompt = agent.systemPrompt;
      promptHash = createHash('sha256').update(agent.systemPrompt).digest('hex');

      // Upsert prompt version record — dynamic import avoids top-level env requirement
      import('./supabase').then(({ supabaseAdmin }) =>
        supabaseAdmin.from('prompt_versions').upsert(
          { agent_id: agentId, prompt_hash: promptHash, last_seen: new Date().toISOString() },
          { onConflict: 'agent_id,prompt_hash', ignoreDuplicates: false }
        )
      ).catch(() => {});
    }
  }

  // ── Primary: Claude Haiku text analysis ────────────────────────────────────
  const agentType = detectAgentType(clientName);
  let analysis: ErrorAnalysis;
  let haiku_failed = false;

  try {
    analysis = await analyzeCallErrors(messages, agentType, { callId, promptHash, agentPrompt });
  } catch (err) {
    // Haiku unavailable (billing, rate limit, network) — Llama webhook will fill errors
    console.error('[call-analyzer] Haiku failed, falling back to Llama:', err instanceof Error ? err.message : err);
    analysis = { ...EMPTY_ANALYSIS };
    haiku_failed = true;
  }

  // ── Fallback / Enrichment: Llama audio pipeline (fire-and-forget) ──────────
  // When haiku_failed=true: Llama is the primary source of errors (full analysis).
  // When haiku_failed=false: Llama only enriches (transcript + names). Errors ignored.
  let enrichment_queued = false;
  queueAudioAnalysis(callId, agentId ?? null, clientName, webhookUrl)
    .then(() => { enrichment_queued = true; })
    .catch(() => { /* recording unavailable or server down — not critical */ });

  return { analysis, enrichment_queued, prompt_hash: promptHash, haiku_failed };
}
