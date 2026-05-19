/**
 * Unified call analysis entry point.
 *
 * Primary:     Claude Haiku — synchronous, highly accurate rule-based error detection
 * Enrichment:  Llama 3.2 (self-hosted audio) — fires async, adds raw_transcript + customer/agent names
 *
 * Llama is NOT used for error detection — it misses errors consistently.
 * Llama results arrive via /api/webhook/transcript and store enrichment only (never overwrite call_errors).
 */
import { queueAudioAnalysis } from './audio-analyzer';
import { analyzeCallErrors, detectAgentType } from './error-analyzer';
import type { ErrorAnalysis } from './error-analyzer';

export interface AnalyzeResult {
  analysis: ErrorAnalysis;
  enrichment_queued: boolean; // true if Llama was also fired for transcript/names
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

  // ── Primary: Claude Haiku text analysis (always, synchronous) ──────────────
  const agentType = detectAgentType(clientName);
  const analysis = await analyzeCallErrors(messages, agentType);

  // ── Enrichment: Llama audio pipeline (fire-and-forget, non-blocking) ───────
  // Only used to get raw_transcript + customer_name + agent_name via webhook.
  // Errors from Llama are intentionally ignored — Haiku is authoritative.
  let enrichment_queued = false;
  queueAudioAnalysis(callId, agentId ?? null, clientName, webhookUrl)
    .then(() => { enrichment_queued = true; })
    .catch(() => { /* recording unavailable or server down — not critical */ });

  return { analysis, enrichment_queued };
}
