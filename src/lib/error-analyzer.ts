import Anthropic from '@anthropic-ai/sdk';

// Lazy-init so the API key is read at call time, not at module load
let _client: Anthropic | null = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export interface CallError {
  type: string;
  severity: 'critical' | 'major' | 'minor';
  agent_line: string;
  what_went_wrong: string;
  should_have_said: string;
  timestamp_index: number; // message ordinal
}

export interface ErrorAnalysis {
  errors: CallError[];
  goal_achieved: boolean;
  goal_outcome: string;
  missed_opportunities: string[];
  summary: string;
  error_count: number;
  critical_error_count: number;
}

export type AgentType = 'sales' | 'debt' | 'cold_outreach' | 'unknown';

export function detectAgentType(clientName: string): AgentType {
  const n = clientName?.toLowerCase() ?? '';
  if (n.includes('debt') || n.includes('collector')) return 'debt';
  if (n.includes('cold') || n.includes('outreach')) return 'cold_outreach';
  if (n.includes('sales') || n.includes('shell gas') || n.includes('uganda comm') ||
      n.includes('edifice') || n.includes('ramco') || n.includes('davansh') ||
      n.includes('acme') || n.includes('nector')) return 'sales';
  return 'sales'; // default to sales analysis
}

function buildAnalysisPrompt(agentType: AgentType, transcript: string): string {
  const base = `You are an expert AI voice agent quality auditor. Analyze this call transcript and identify SPECIFIC mistakes the agent made.

Return ONLY valid JSON matching this exact schema:
{
  "errors": [
    {
      "type": string,
      "severity": "critical" | "major" | "minor",
      "agent_line": "exact quote from transcript",
      "what_went_wrong": "concise explanation",
      "should_have_said": "what the correct response would be",
      "timestamp_index": number (message index, 0-based)
    }
  ],
  "goal_achieved": boolean,
  "goal_outcome": string,
  "missed_opportunities": [string],
  "summary": string (1-2 sentences),
  "error_count": number,
  "critical_error_count": number
}`;

  const agentRules: Record<AgentType, string> = {
    sales: `
AGENT TYPE: Sales AI (property/product outbound sales)

RULES THIS AGENT MUST FOLLOW:
1. Ask questions ONE AT A TIME — never stack multiple questions
2. NEVER accept garbled/unclear answers — must ask "I'm sorry, could you repeat that?"
2a. LOCATION ANSWERS: When asking "Any area in mind?", ONLY accept a clearly named recognizable Ugandan neighborhood (Bugolobi, Kira, Kiwatule, Naguru, Nalya, Namugongo, Kololo, Ntinda, etc.). If the customer's answer is unclear, noise, or not a real area — this is accepted_unknown_location (CRITICAL).
3. NEVER accept a past date for appointment/callback — must reject and re-ask
4. NEVER make promises it can't keep (e.g. "I'll send you floor plans", "Let me connect you now")
5. After 3-4 answers, provide consultative value-add using context — don't just fire questions
6. Handle objections naturally (e.g. "too expensive" → explain payment plans)
7. Must call saveAnswers BEFORE hangUp — ONLY flag no_save_answers if the transcript has 4+ agent turns AND no Tool message appears in the final 4 messages of the transcript. Short/truncated transcripts with fewer than 4 agent turns should NOT be flagged.
8. NEVER invent property/price details not in context
9. When customer says "sorry?" → repeat EXACT last sentence, don't advance
10. When confused twice in a row → go back one step, re-ask the question

ERROR TYPES TO DETECT:
- accepted_unknown_location: Agent accepted an unclear or unrecognizable area/neighborhood name as a valid answer (CRITICAL — use this when the customer's response to "Any area in mind?" was garbled, vague, or not a real Ugandan neighborhood, but agent proceeded anyway)
- accepted_garbled_audio: Agent treated unclear STT as valid answer (general — not location-specific)
- accepted_past_date: Agent accepted and saved a past date
- broke_promise: Agent promised something it can't deliver
- stacked_questions: Agent asked multiple questions at once
- wrong_info: Agent stated incorrect property/price details
- skipped_repeat_rule: Customer said "sorry?" but agent advanced instead of repeating
- no_save_answers: Call ended without saveAnswers tool call (CRITICAL)
- no_consultation: Agent just fired questions with no value-add after collecting enough info
- wrong_call_type: Agent executed wrong flow (e.g. marketing call handled as inbound)

GOAL: Book appointment or schedule callback with interested lead.`,

    debt: `
AGENT TYPE: Debt Collector

RULES THIS AGENT MUST FOLLOW:
1. State {{product_name}} BEFORE the amount — customer needs context
2. NEVER calculate remaining balance (only read 3 values: amount_due, total_purchase_value, paid_till_now)
3. NEVER invent amounts — only use values from context
4. Get an EXACT commitment date — "end of month", "soon", "later" are NOT acceptable
5. Must call saveDebt BEFORE hangUp — ONLY flag no_save_debt if the transcript has 4+ agent turns AND no Tool message appears in the final 4 messages. Do not flag truncated/short calls.
6. When customer says "sorry?" → repeat EXACT last sentence
7. NEVER switch to Luganda — if customer requests it, redirect: "Someone from our team who speaks Luganda will call you back"
8. For "stop calling" → escalate, don't argue
9. Resolve relative dates ("tomorrow", "next Monday") to exact YYYY-MM-DD before saving
10. NEVER accept past dates for promised_date

ERROR TYPES TO DETECT:
- calculated_balance: Agent computed remaining balance (e.g. "so you owe X more")
- invented_amount: Agent stated amount not from context variables
- accepted_vague_date: Agent accepted "soon/later/next week" without exact date
- accepted_past_date: Agent accepted a date in the past
- no_save_debt: Call ended without saveDebt (CRITICAL)
- spoke_luganda: Agent used Luganda phrases outside the redirect
- no_product_context: Agent stated amount without first saying what product it's for
- no_commitment: Call ended with no payment commitment or escalation
- wrong_escalation: Agent failed to escalate when it should have

GOAL: Get exact payment commitment date OR escalate to human team.`,

    cold_outreach: `
AGENT TYPE: Cold Outreach AI (marketing calls, no prior relationship)

RULES THIS AGENT MUST FOLLOW:
1. Opening: "Hello... Good [time]... My name is [agent]... calling from [company]..." — NEVER "Am I speaking with...?" (no name provided)
2. When customer says "Hello/Yes/Morning" mid-opening → acknowledge with "uhm..." and CONTINUE, do NOT restart
3. After customer engages with YES → collect name before asking questions
4. Wrong number handling: "Oh I'm really sorry... anyway I'm sending you details on WhatsApp... have a wonderful day" → save → hangUp
5. NEVER accept garbled audio as valid answer
6. If customer not interested → don't push back, give WhatsApp redirect and close
7. Must call saveAnswers BEFORE hangUp — ONLY flag no_save_answers if the transcript has 4+ agent turns AND no Tool message appears in the final 4 messages. Do not flag truncated/short calls.
8. NEVER ask "Am I speaking to [name]?" — there is no name in cold outreach

ERROR TYPES TO DETECT:
- wrong_opening: Agent asked "Am I speaking with?" instead of cold opening
- restart_loop: Agent restarted opening after customer acknowledgment
- no_name_collected: Agent proceeded to questions without collecting name after YES engagement
- accepted_garbled_audio: Treated unclear response as valid answer
- wrong_person_handling: Wrong number case not handled with WhatsApp redirect phrase
- no_save_answers: Call ended without saveAnswers (CRITICAL)
- pushed_back: Agent argued or pushed when customer said not interested

GOAL: Get customer name + answer questions + schedule callback/appointment.`,

    unknown: `
AGENT TYPE: Unknown — analyze for general quality issues.

ERROR TYPES TO DETECT:
- no_tool_call: No data save tool called before hangup (CRITICAL)
- accepted_garbled_audio: Unclear answer treated as valid
- accepted_past_date: Past date accepted
- made_promise: Promise agent can't keep
- no_commitment: No clear next step achieved
- wrong_flow: Agent executed wrong type of call flow`
  };

  return `${base}

${agentRules[agentType]}

TRANSCRIPT:
${transcript}

Analyze only ACTUAL mistakes. If the agent performed well, errors array can be empty. Be specific — quote exact agent lines. Focus on errors that hurt the call outcome or violate rules above.`;
}

function formatTranscript(messages: Array<{ role: string; text: string; ordinal: number }>): string {
  const sorted = messages.sort((a, b) => a.ordinal - b.ordinal);
  const lines = sorted.map((m, i) => {
    const role = m.role.includes('AGENT') || m.role === 'agent' ? 'Agent' :
                 m.role.includes('TOOL') ? 'Tool' : 'User';
    return `[${i}] ${role}: ${m.text}`;
  });
  // ~4 chars per token; keep well under 180k tokens of transcript budget
  const MAX_CHARS = 600_000;
  const full = lines.join('\n');
  if (full.length <= MAX_CHARS) return full;
  // Keep first 20% (opening) + last 80% (resolution/save) — errors cluster at end
  const head = Math.floor(MAX_CHARS * 0.2);
  const tail = MAX_CHARS - head;
  return full.slice(0, head) + '\n[... transcript truncated ...]\n' + full.slice(-tail);
}

export async function analyzeCallErrors(
  messages: Array<{ role: string; text: string; ordinal: number }>,
  agentType: AgentType
): Promise<ErrorAnalysis> {
  if (messages.length === 0) {
    return {
      errors: [],
      goal_achieved: false,
      goal_outcome: 'no_transcript',
      missed_opportunities: [],
      summary: 'No messages to analyze.',
      error_count: 0,
      critical_error_count: 0,
    };
  }

  const transcript = formatTranscript(messages);
  const prompt = buildAnalysisPrompt(agentType, transcript);

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in analysis response');
  }

  const analysis = JSON.parse(jsonMatch[0]) as ErrorAnalysis;
  analysis.error_count = analysis.errors?.length ?? 0;
  analysis.critical_error_count = analysis.errors?.filter(e => e.severity === 'critical').length ?? 0;

  return analysis;
}
