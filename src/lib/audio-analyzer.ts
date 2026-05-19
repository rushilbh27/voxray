import { detectAgentType, type AgentType } from './error-analyzer';
import type { ErrorAnalysis, CallError } from './error-analyzer';

const LLAMA_SERVER = 'http://72.61.206.216:8000/process-call';
const RECORDING_FETCH_TIMEOUT_MS = 180_000; // 3min — long calls = large WAV files
const LLAMA_QUEUE_TIMEOUT_MS = 120_000;     // 2min — upload large WAV to Llama

function buildSystemPrompt(agentType: AgentType): string {
  const rules: Record<AgentType, string> = {
    sales: `You are an expert AI voice agent quality auditor for a Sales AI (property/product outbound sales) agent operating in Uganda.

RULES THIS AGENT MUST FOLLOW:
1. Ask questions ONE AT A TIME — never stack multiple questions
2. NEVER accept garbled/unclear audio — must say "I'm sorry, could you repeat that?"
3. LOCATION: when asking "Any area in mind?", only accept a real named Ugandan neighborhood (Bugolobi, Kira, Kiwatule, Naguru, Nalya, Namugongo, Kololo, Ntinda, etc). Unclear/noise/fake area = accepted_unknown_location (CRITICAL).
4. NEVER accept a past date for appointment/callback
5. NEVER make promises it cannot keep (floor plans, direct connection, etc)
6. After collecting 3-4 answers, provide consultative value-add — don't just fire questions
7. Must call saveAnswers BEFORE hangUp. Only flag no_save_answers if 4+ agent turns occurred AND no tool/save message in final 4 turns.
8. When customer says "sorry?" → repeat EXACT last sentence unchanged
GOAL: Book appointment or schedule callback with interested lead.`,

    debt: `You are an expert AI voice agent quality auditor for a Debt Collector agent operating in Uganda.

RULES THIS AGENT MUST FOLLOW:
1. State product name BEFORE the amount — customer needs context first
2. NEVER calculate remaining balance — only read the 3 context values as-is
3. NEVER state an amount that wasn't given in context variables
4. Get an EXACT commitment date — "end of month", "soon", "next week" are NOT acceptable
5. Must call saveDebt BEFORE hangUp. Only flag no_save_debt if 4+ agent turns AND no tool/save call at end.
6. When customer says "sorry?" → repeat EXACT last sentence
7. NEVER use Luganda — redirect: "Someone from our team who speaks Luganda will call you back"
8. Convert relative dates ("tomorrow", "next Monday") to exact YYYY-MM-DD
GOAL: Get exact payment commitment date OR escalate to human team.`,

    cold_outreach: `You are an expert AI voice agent quality auditor for a Cold Outreach AI (marketing, no prior relationship) agent operating in Uganda.

RULES THIS AGENT MUST FOLLOW:
1. Opening MUST be: "Hello... Good [time]... My name is [X]... calling from [company]..." — NEVER "Am I speaking with...?" (no name was provided)
2. When customer says "Hello/Yes/Morning" mid-opening → say "uhm..." and CONTINUE — do NOT restart greeting
3. After customer engages → collect customer name BEFORE asking any questions
4. Wrong number: apologize + "I'll send you details on WhatsApp... have a wonderful day" → save → hangUp
5. NEVER accept garbled audio as a valid answer
6. Customer not interested → don't argue — give WhatsApp redirect and close
7. Must call saveAnswers BEFORE hangUp. Only flag no_save_answers if 4+ agent turns AND no save call.
GOAL: Get name + answers + schedule callback/appointment.`,

    unknown: `You are an expert AI voice agent quality auditor.
Analyze for general quality: data saves before hangup, garbled audio accepted, past dates accepted, promises made that can't be kept, no clear next step.
GOAL: Identify any clear agent mistakes.`,
  };
  return rules[agentType];
}

function buildRequiredFields(): string {
  return JSON.stringify({
    errors: 'JSON array. Each item: {"type":"<error_code>","severity":"<critical|major|minor>","agent_line":"<exact quote>","what_went_wrong":"<brief>","should_have_said":"<better response>"}. Valid types: accepted_unknown_location, accepted_garbled_audio, accepted_past_date, broke_promise, stacked_questions, wrong_info, skipped_repeat_rule, no_save_answers, no_consultation, wrong_call_type, calculated_balance, invented_amount, accepted_vague_date, no_save_debt, spoke_luganda, no_product_context, no_commitment, wrong_opening, restart_loop, no_name_collected, wrong_person_handling, pushed_back. Return [] if no errors.',
    goal_achieved: 'true or false',
    goal_outcome: 'one of: success, no_answer, no_save, garbled_audio, wrong_number, not_interested, incomplete',
    missed_opportunities: 'JSON array of strings — coaching notes, not rule violations. Return [] if none.',
    summary: '1-2 sentences on overall call quality',
    customer_name: 'customer name if spoken, else empty string',
    agent_name: 'agent name if mentioned, else empty string',
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function queueAudioAnalysis(
  callId: string,
  agentId: string | null,
  clientName: string,
  webhookUrl: string
): Promise<{ status: string; message?: string }> {
  // 1. Fetch recording from Ultravox
  const audioRes = await fetchWithTimeout(
    `https://api.ultravox.ai/api/calls/${callId}/recording`,
    { headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! } },
    RECORDING_FETCH_TIMEOUT_MS
  );

  if (audioRes.status === 404) {
    throw new RecordingNotFoundError(`No recording for call ${callId} — recording may be disabled`);
  }
  if (!audioRes.ok) {
    throw new Error(`Ultravox recording fetch failed: ${audioRes.status}`);
  }

  const audioBuffer = await audioRes.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new RecordingNotFoundError(`Empty recording for call ${callId}`);
  }

  // 2. Build and POST form data to self-hosted Llama server
  const agentType = detectAgentType(clientName);
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), `${callId}.wav`);
  formData.append('webhook_url', webhookUrl);
  formData.append('call_id', callId);
  formData.append('uid', agentId ?? clientName);
  formData.append('system_prompt', buildSystemPrompt(agentType));
  formData.append('required_fields', buildRequiredFields());

  const llamaRes = await fetchWithTimeout(
    LLAMA_SERVER,
    { method: 'POST', body: formData },
    LLAMA_QUEUE_TIMEOUT_MS
  );

  if (!llamaRes.ok) {
    const body = await llamaRes.text().catch(() => '');
    throw new Error(`Llama server error ${llamaRes.status}: ${body}`);
  }

  return llamaRes.json();
}

export function parseExtractedToAnalysis(extracted: Record<string, unknown>): ErrorAnalysis {
  let errors: CallError[] = [];
  try {
    const raw = extracted.errors;
    if (typeof raw === 'string') errors = JSON.parse(raw);
    else if (Array.isArray(raw)) errors = raw as CallError[];
  } catch { /* malformed — treat as no errors */ }

  let missedOpportunities: string[] = [];
  try {
    const raw = extracted.missed_opportunities;
    if (typeof raw === 'string') missedOpportunities = JSON.parse(raw);
    else if (Array.isArray(raw)) missedOpportunities = raw as string[];
  } catch { /* ignore */ }

  const error_count = errors.length;
  const critical_error_count = errors.filter(e => e.severity === 'critical').length;

  return {
    errors,
    goal_achieved: extracted.goal_achieved === 'true' || extracted.goal_achieved === true,
    goal_outcome: String(extracted.goal_outcome ?? 'unknown'),
    missed_opportunities: missedOpportunities,
    summary: String(extracted.summary ?? ''),
    error_count,
    critical_error_count,
  };
}

// Sentinel — callers can catch this specifically to skip fallback
export class RecordingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordingNotFoundError';
  }
}
