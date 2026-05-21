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
import { supabaseAdmin } from './supabase';

export interface AnalyzeResult {
  analysis: ErrorAnalysis;
  enrichment_queued: boolean;
  prompt_hash?: string; // SHA-256 of the agent's system prompt at analysis time
}

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
  if (agentId) {
    const agent = await fetchAgent(agentId).catch(() => null);
    if (agent?.systemPrompt) {
      promptHash = createHash('sha256').update(agent.systemPrompt).digest('hex');

      // Upsert prompt version record — track when each prompt hash was active
      void supabaseAdmin
        .from('prompt_versions')
        .upsert(
          { agent_id: agentId, prompt_hash: promptHash, last_seen: new Date().toISOString() },
          { onConflict: 'agent_id,prompt_hash', ignoreDuplicates: false }
        );
    }
  }

  // ── Primary: Claude Haiku text analysis (always, synchronous) ──────────────
  const agentType = detectAgentType(clientName);
  const analysis = await analyzeCallErrors(messages, agentType, { callId, promptHash });

  // ── Enrichment: Llama audio pipeline (fire-and-forget, non-blocking) ───────
  // Only used to get raw_transcript + customer_name + agent_name via webhook.
  // Errors from Llama are intentionally ignored — Haiku is authoritative.
  let enrichment_queued = false;
  queueAudioAnalysis(callId, agentId ?? null, clientName, webhookUrl)
    .then(() => { enrichment_queued = true; })
    .catch(() => { /* recording unavailable or server down — not critical */ });

  return { analysis, enrichment_queued, prompt_hash: promptHash };
}
