/**
 * Unified call analysis entry point.
 * Primary:  Llama 3.2 (self-hosted audio pipeline) — free, no token limits
 * Fallback: Claude Haiku (text transcript) — triggers on any Llama failure
 *
 * Callers never need to know which path ran.
 */
import { queueAudioAnalysis, RecordingNotFoundError } from './audio-analyzer';
import { analyzeCallErrors, detectAgentType } from './error-analyzer';
import type { ErrorAnalysis } from './error-analyzer';

export type AnalyzeResult =
  | { method: 'audio'; status: 'queued' }
  | { method: 'text';  status: 'complete'; analysis: ErrorAnalysis };

interface AnalyzeCallOptions {
  callId: string;
  agentId?: string | null;
  clientName: string;
  /** Text messages — used for Haiku fallback */
  messages: Array<{ role: string; text: string; ordinal: number }>;
  /** Webhook URL for async Llama delivery */
  webhookUrl: string;
}

export async function analyzeCall(opts: AnalyzeCallOptions): Promise<AnalyzeResult> {
  const { callId, agentId, clientName, messages, webhookUrl } = opts;

  // ── Primary: Llama audio pipeline ──────────────────────────────────────────
  try {
    await queueAudioAnalysis(callId, agentId ?? null, clientName, webhookUrl);
    return { method: 'audio', status: 'queued' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);

    if (err instanceof RecordingNotFoundError) {
      // Recording disabled or empty — skip Haiku too, nothing to analyze from audio
      // Still try text fallback
      console.warn(`[call-analyzer] No recording for ${callId} — falling back to text`);
    } else {
      console.warn(`[call-analyzer] Llama failed for ${callId}: ${reason} — falling back to Haiku`);
    }
  }

  // ── Fallback: Claude Haiku text pipeline ───────────────────────────────────
  const agentType = detectAgentType(clientName);
  const analysis = await analyzeCallErrors(messages, agentType);
  return { method: 'text', status: 'complete', analysis };
}
