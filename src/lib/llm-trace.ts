/**
 * Fire-and-forget LLM call tracing.
 * Records latency, tokens, and cost for every Haiku analysis to llm_traces.
 * Never throws to caller — failure to trace must never fail analysis.
 *
 * Uses dynamic import for supabaseAdmin so scripts that load this module
 * before env vars are set (e.g. analyze-calls.ts) don't crash on startup.
 */

export interface LlmTraceInput {
  call_id?:       string;
  model:          string;
  purpose:        'error_analysis' | 'enrichment_attempt';
  agent_type?:    string;
  input_tokens?:  number;
  output_tokens?: number;
  latency_ms?:    number;
  cost_usd?:      number;
  success:        boolean;
  error_message?: string;
  prompt_hash?:   string;
}

export function recordLlmTrace(trace: LlmTraceInput): void {
  import('./supabase').then(({ supabaseAdmin }) =>
    supabaseAdmin.from('llm_traces').insert(trace)
  ).catch(() => {});
}

// Haiku 4.5 pricing: $0.80 / 1M input tokens, $4.00 / 1M output tokens
export function computeHaikuCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens * 0.80 + outputTokens * 4.00) / 1_000_000;
}
