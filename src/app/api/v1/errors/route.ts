import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { checkApiKey } from '@/lib/api-auth';

export const revalidate = 60;

const HUMAN_LABELS: Record<string, string> = {
  accepted_garbled_audio:   'Accepted unclear audio as a valid answer',
  no_save_answers:          'Call ended without saving answers — data lost',
  no_consultation:          'No value-add after collecting requirements',
  stacked_questions:        'Asked multiple questions at once',
  no_product_context:       'Stated amount before explaining the product',
  no_save_debt:             'Call ended without saving debt data — data lost',
  accepted_past_date:       'Accepted a date that already passed',
  skipped_repeat_rule:      "Didn't repeat after customer said 'sorry?'",
  broke_promise:            "Promised something the agent can't deliver",
  wrong_opening:            "Used 'Am I speaking with?' on a cold call",
  restart_loop:             'Restarted full greeting after customer interrupted',
  no_name_collected:        'Collected answers without getting customer name first',
  calculated_balance:       'Calculated remaining balance (explicitly forbidden)',
  invented_amount:          'Stated an amount not from context variables',
  accepted_vague_date:      "Accepted vague date like 'soon' or 'next week'",
  wrong_person_handling:    'Wrong number not closed with WhatsApp redirect',
  spoke_luganda:            'Used Luganda instead of redirect script',
  no_commitment:            'Call ended with no payment commitment or escalation',
  pushed_back:              'Argued or re-pitched after customer said not interested',
  wrong_info:               'Stated incorrect property or price details',
  wrong_call_type:          'Executed wrong call flow (inbound vs outbound)',
};

const FIX_SUGGESTIONS: Record<string, string> = {
  accepted_garbled_audio: "The GARBLED AUDIO RULE is already in the prompt — the agent is ignoring it. Add a counter rule: 'If this is the SECOND consecutive unclear response to the SAME question, stop re-asking. Say: I'm having trouble hearing you clearly — let me have our team follow up at a better time. Then call saveAnswers with whatever data was collected and hang up.' Also check VAD sensitivity in Ultravox settings.",
  no_save_answers: "Agent is exiting via an early path (busy, objection, wrong number) without hitting the COMPLETION section. Add to LEAD HANDLING LOGIC: 'No matter how the call ends — busy, not interested, wrong number, or completed — saveAnswers MUST be called before hangUp. There is no exception.'",
  no_consultation: "CONSULTATIVE VALUE-ADD fires after 3-4 answers but agents skip it. Add a hard gate after Q3: 'After Q3 answer, STOP before Q4. Review collected data. Use context to identify 2-3 relevant matches. Share ONE match in 1-2 sentences and ask a check-in question. Only after response continue to Q4.'",
  stacked_questions: "QUESTION ECONOMY RULE says ask one at a time. Review every {{question1}}-{{question10}} for compound phrasing using 'and' or 'or'. Split into separate slots. Add: 'If you catch yourself asking two questions in one sentence, stop, say Uhm sorry — let me take that one at a time, and re-ask only the first.'",
  no_product_context: "Debt agent rule 1: state product name BEFORE amount. Fix opener: 'Your FIRST sentence after confirming identity MUST be: I'm calling about your [product_name] purchase... you have an installment of [amount_due] due. The product name must come first — the amount means nothing without that context.'",
  no_save_debt: "Same root cause as no_save_answers — early exits bypass the save gate. Add: 'Every call path ends with saveDebt before hangUp — no exceptions. Busy: call_status = callback_scheduled. Not interested: call_status = not_interested. Wrong number: is_lead = false. A call without saveDebt is complete data loss.'",
  accepted_past_date: "The DATE RESOLUTION ENGINE has PAST DATE VALIDATION (CHECK 1) already defined. Agent resolves date but skips validation. Add: 'Before confirming any date back to the customer, silently compare to {{current_date}}. If resolved date < {{current_date}}, do NOT confirm it. Say: That date would actually be in the past — could you give me a future date?'",
  skipped_repeat_rule: "INTERRUPTION & CONFUSION HANDLING is in the prompt but agent advances anyway. Strengthen: 'CONFUSION = FULL STOP. When customer says sorry/pardon/what/huh — the ONLY valid response is the EXACT sentence you just said, unchanged. Not a paraphrase. Not a summary. Word for word. Advancing after confusion is a CRITICAL VIOLATION.'",
  broke_promise: "Add FORBIDDEN PHRASES list: 'NEVER say: I will send you floor plans, I will send you photos, I will connect you now, Let me transfer you. Replace ALL with: Our team will follow up with you with full details after this call. This is the only promise you are allowed to make.'",
  wrong_opening: "Cold outreach rule: never ask 'Am I speaking with?' when no name is available. Add self-check: 'Before first word, check: do I have a {{client_name}} value? If empty or null, do NOT use identity-check opening. Start with: Hello... Good {{time}}... My name is {{agent_name}}... calling from {{company_name}}.'",
  restart_loop: "Agent interprets any sound during opening as invitation to restart. Add: 'If customer says Hello/Yes/Morning during opening — acknowledge with uhm and continue from exactly where you left off. Do NOT restart from Hello. Restarting the greeting is a CRITICAL VIOLATION that creates a VAD loop.'",
  no_name_collected: "Add gate: 'When customer responds positively to opening, your VERY NEXT sentence must be: That's great... uhm... could I get your name first? Only after they give their name do you proceed to question 1. Asking Q1 without a name is a violation.'",
  calculated_balance: "Add: 'You have exactly THREE numbers: amount_due, total_purchase_value, paid_till_now. You are allowed to READ these. NEVER subtract, add, or derive a fourth number. If customer asks how much is left, say: I only have the current installment amount — our team can confirm the full breakdown.'",
  invented_amount: "Add: 'Before stating any monetary amount, ask yourself: where exactly in my context does this number appear? If you cannot point to the exact variable it came from, do NOT say it. Say: I want to make sure I give you the right figures — let me have our team confirm the exact amount.'",
  accepted_vague_date: "Add: 'Vague date phrases are NOT valid inputs. When customer says soon/later/sometime next week/end of month — do NOT save. Say: I need a specific date so our team can plan for you — what exact date works? Like the 15th of June, for example? Do not move on until they give a day you can resolve to YYYY-MM-DD.'",
  wrong_person_handling: "WRONG NUMBER handling is defined with exact redirect script. Add emphasis: '(1) Say: I sincerely apologize for the confusion — I will make sure this is corrected — have a great day. (2) Call saveAnswers with is_lead = false, call_status = not_interested, all q/a slots null. (3) ONLY after saveAnswers returns, call hangUp.'",
  spoke_luganda: "Debt prompt rule 7: never switch to Luganda. Add: 'If customer speaks Luganda or requests it, do NOT attempt any Luganda words. Say exactly: I'm sorry — I don't speak Luganda, but I will arrange for someone from our team who does to call you back. Then set call_status = callback_scheduled and call saveDebt.'",
  no_commitment: "Add escalation gate: 'If after 2 attempts to get a commitment date the customer still deflects, do NOT accept it. Say: I completely understand — let me pass this to our team so they can work out a plan that suits you. Set action = escalate, call saveDebt, close the call.'",
  pushed_back: "Add: 'If customer says not interested or any clear rejection — do NOT counter-offer, do NOT re-explain the product. Say exactly: I completely understand — let me just send you some details on WhatsApp in case it's useful later... have a wonderful day. Then call saveAnswers with interest = cold, call_status = not_interested.'",
  wrong_info: "Add: 'NEVER state a price, sq footage, floor number, availability, or feature not explicitly written in your context. If customer asks for a detail not in context, say: That is a great question — I want to give you exact details, so let me have our team confirm that and follow up directly. Log in unanswered_questions.'",
  wrong_call_type: "Add decision checkpoint as first instruction: 'Read call_type. If call_type = outbound, skip INBOUND MODE entirely. If call_type is null/empty/missing, skip OUTBOUND sections entirely. These two flows share zero steps. If uncertain, treat as inbound.'",
};

export async function GET(request: Request) {
  const denied = checkApiKey(request);
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const agentFilter = searchParams.get('agent') ?? '';

  let query = supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at')
    .eq('analysis_status', 'complete')
    .gt('error_count', 0)
    .range(0, 9999);

  if (agentFilter) query = query.eq('client_name', agentFilter);

  const { data: errorCalls } = await query;
  const { count: totalAnalyzed } = await supabaseAdmin
    .from('ultravox_calls')
    .select('*', { count: 'exact', head: true })
    .eq('analysis_status', 'complete');

  const freqMap = new Map<string, {
    type: string;
    human_label: string;
    count: number;
    critical_count: number;
    fix_suggestion: string | null;
    agents: string[];
    example_call_id: string;
  }>();

  for (const call of errorCalls ?? []) {
    const analysis = call.call_errors as ErrorAnalysis | null;
    if (!analysis?.errors) continue;
    for (const err of analysis.errors) {
      if (!freqMap.has(err.type)) {
        freqMap.set(err.type, {
          type: err.type,
          human_label: HUMAN_LABELS[err.type] ?? err.type.replace(/_/g, ' '),
          count: 0,
          critical_count: 0,
          fix_suggestion: FIX_SUGGESTIONS[err.type] ?? null,
          agents: [],
          example_call_id: call.call_id,
        });
      }
      const freq = freqMap.get(err.type)!;
      freq.count++;
      if (err.severity === 'critical') freq.critical_count++;
      if (!freq.agents.includes(call.client_name)) freq.agents.push(call.client_name);
    }
  }

  const errors = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);

  const worstCalls = [...(errorCalls ?? [])]
    .sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0))
    .slice(0, 10)
    .map((c) => {
      const analysis = c.call_errors as ErrorAnalysis | null;
      return {
        call_id: c.call_id,
        agent: c.client_name,
        error_count: c.error_count,
        critical_error_count: c.critical_error_count,
        summary: analysis?.summary ?? null,
        goal_achieved: analysis?.goal_achieved ?? null,
        created_at: c.created_at,
      };
    });

  return NextResponse.json({
    total_analyzed: totalAnalyzed ?? 0,
    calls_with_errors: errorCalls?.length ?? 0,
    total: errors.length,
    count: errors.length,
    offset: 0,
    has_more: false,
    errors,
    worst_calls: worstCalls,
  });
}
