import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { fetchAgentPrompts } from '@/lib/ultravox';
import { getApplicablePatches } from '@/lib/fix-specs';
import { FixBlock } from '@/app/components/FixBlock';
import { TrendChart } from '@/app/components/TrendChart';
import { LogFixButton } from '@/app/components/LogFixButton';
import { AckAlertButton } from '@/app/components/AckAlertButton';
import { FalsePositiveButton } from '@/app/components/FalsePositiveButton';
import { Nav } from '@/app/components/Nav';

export const revalidate = 60;

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  client?: string;
  status?: string;
  eagent?: string;
  range?: string;
  compare?: string;
}

const HUMAN_LABELS: Record<string, string> = {
  accepted_unknown_location: 'Accepted unrecognizable area name',
  accepted_garbled_audio:   'Accepted unclear audio as valid answer',
  no_save_answers:          'Call ended without saving answers',
  no_consultation:          'No value-add after collecting requirements',
  stacked_questions:        'Asked multiple questions at once',
  no_product_context:       'Stated amount before explaining product',
  no_save_debt:             'Call ended without saving debt data',
  accepted_past_date:       'Accepted a date that already passed',
  skipped_repeat_rule:      "Didn't repeat after customer said 'sorry?'",
  broke_promise:            "Promised something agent can't deliver",
  wrong_opening:            "Used 'Am I speaking with?' on cold call",
  restart_loop:             'Restarted full greeting after interruption',
  no_name_collected:        'Collected answers without getting name first',
  calculated_balance:       'Calculated remaining balance (forbidden)',
  invented_amount:          'Stated amount not from context variables',
  accepted_vague_date:      "Accepted vague date like 'soon'",
  wrong_person_handling:    'Wrong number not closed with WhatsApp redirect',
  spoke_luganda:            'Used Luganda instead of redirect script',
  no_commitment:            'Call ended with no payment commitment',
  pushed_back:              'Argued after customer said not interested',
  wrong_info:               'Stated incorrect property or price details',
  wrong_call_type:          'Executed wrong call flow',
};

const FIX_SUGGESTIONS: Record<string, string> = {
  accepted_garbled_audio:
    "The GARBLED AUDIO RULE is already in the prompt — the agent is ignoring it. Add a counter rule: 'If this is the SECOND consecutive unclear response to the SAME question, stop re-asking. Say: I'm having trouble hearing you clearly — let me have our team follow up at a better time. Then call saveAnswers with whatever data was collected and hang up. Do not loop more than once on a bad line.' Also check VAD sensitivity in Ultravox settings — overly aggressive VAD triggers the model before the customer finishes speaking.",

  no_save_answers:
    "The agent is exiting the call via an early path (busy customer, objection, wrong number) without hitting the COMPLETION section. Add this rule to LEAD HANDLING LOGIC: 'No matter how the call ends — busy, not interested, wrong number, or completed — saveAnswers MUST be called before hangUp. There is no exception. Even if you only collected 1 answer, save what you have with call_status = needs_followup.' Also verify the WRONG NUMBER section explicitly calls saveAnswers — it already should per the prompt, but check call transcripts to confirm the tool was invoked.",

  no_consultation:
    "CONSULTATIVE VALUE-ADD fires after 3-4 answers but agents skip it when they've collected all questions. Add a hard gate after Q3: 'After the customer answers Q3, STOP before asking Q4. Review what you have collected. Use context to identify 2-3 relevant matches. Share ONE match in 1-2 sentences and ask a check-in question. Only after their response do you continue to Q4.' If context has nothing matching: 'Based on what you've shared, our team will prepare specific options for you — I want to make sure what we show you is exactly right.'",

  stacked_questions:
    "QUESTION ECONOMY RULE says ask one at a time — agent combines two in one turn. Review every question in {{question1}} through {{question10}} for compound phrasing using 'and' or 'or'. Split compound questions into two separate question slots. Add to prompt: 'Before asking any question, check: does this sentence contain two separate asks? If yes, ask only the first. Save the second for the next turn.' Also add: 'If you catch yourself asking two questions in one sentence, stop mid-sentence, say Uhm, sorry — let me take that one at a time, and re-ask just the first question.'",

  no_product_context:
    "Debt agent rule 1 is explicit: state product name BEFORE amount. The agent reverses the order. Fix the debt opener script: 'Your FIRST sentence after confirming identity MUST follow this structure exactly: I'm calling about your [product_name] purchase... you have an installment of [amount_due] that is due on [due_date]. The product name must come first — the amount means nothing to the customer without that context.' Add a self-check rule: 'If you are about to say a number, ask yourself: have I already said the product name this turn? If not, state the product name first.'",

  no_save_debt:
    "Same root cause as no_save_answers — early call exits bypass the save gate. Add identical rule to debt prompt: 'Every call path ends with saveDebt before hangUp — no exceptions. Busy customer: save with call_status = callback_scheduled. Not interested: save with call_status = not_interested. Wrong number: save with is_lead = false. A call without saveDebt is a complete data loss.' Also add the SAVE FAILURE PROTOCOL from the prompt — if saveDebt errors, retry once, then close gracefully.",

  accepted_past_date:
    "The DATE RESOLUTION ENGINE has PAST DATE VALIDATION with CHECK 1 already defined. The agent resolves the date but skips the validation step. Add a forced silent check before confirming any date: 'Before you say the resolved date back to the customer, silently compare it to {{current_date}}. If resolved date < {{current_date}}, do NOT confirm it. Say immediately: Uhm... I just want to make sure I have this right... that date would actually be in the past... could you give me a future date that works for you? NEVER confirm a past date even if the customer insists yes that is correct.'",

  skipped_repeat_rule:
    "INTERRUPTION & CONFUSION HANDLING rule is in the prompt but the agent advances anyway — this is a critical pattern failure. Strengthen the rule with explicit language: 'CONFUSION = FULL STOP. When the customer says sorry / pardon / what / huh / come again — the ONLY valid response is the EXACT sentence you just said, unchanged. Not a paraphrase. Not a shorter version. Not a summary. The same words in the same order. After repeating, wait silently. Do NOT add any new information. Do NOT advance to the next question. Advancing after confusion is a CRITICAL VIOLATION and must never happen.'",

  broke_promise:
    "Add a FORBIDDEN PHRASES list to the prompt: 'You are NEVER allowed to say: I will send you floor plans, I will send you photos, I will connect you with our manager now, Let me transfer you, I will WhatsApp you details right now. Replace all of these with: Our team will follow up with you with full details after this call. This is the only promise you can make. If you catch yourself about to make a promise, pause and substitute the approved phrase.'",

  wrong_opening:
    "Cold outreach rule is explicit: never ask 'Am I speaking with?' when no name is available. The CALL OPENING section has the correct script — the agent is ignoring it. Add a self-check before first utterance: 'Before you speak your first word, check: do I have a {{client_name}} value? If client_name is empty or null, do NOT use the identity-check opening. Start with: Hello... Good {{time}}... My name is {{agent_name}}... calling from {{company_name}}... Is this a good time to talk?' Never personalise a cold open to a name you don't have.",

  restart_loop:
    "The agent interprets any sound during the opening as an invitation to restart. Add to prompt: 'If the customer says Hello, Yes, Morning, or any acknowledgment WHILE you are mid-opening — acknowledge with uhm and continue from exactly where you left off. Do NOT restart from Hello. Do NOT repeat the company introduction. Pick up at the next word of your opening and continue naturally. Restarting the greeting is a CRITICAL VIOLATION that creates a VAD loop.'",

  no_name_collected:
    "Cold outreach prompt requires name collection after first positive engagement. The agent skips it and goes straight to questions. Add a gate: 'When the customer responds positively to your opening (says Yes / I'm listening / Go ahead / Okay), your VERY NEXT sentence must be: That's great... uhm... could I get your name first? Only after they give their name do you proceed to question 1. Asking question 1 without a name is a violation.'",

  calculated_balance:
    "Debt prompt explicitly prohibits balance calculations — the agent is doing arithmetic and stating a derived number. Add: 'You have exactly THREE numbers available: amount_due, total_purchase_value, paid_till_now. You are allowed to READ these values. You are NEVER allowed to subtract, add, or derive a fourth number from them. If the customer asks how much is left to pay, say: I only have the current installment amount due — our team can confirm the full breakdown. Stating any calculated figure is a CRITICAL VIOLATION.'",

  invented_amount:
    "The agent states a number that does not exist in templateContext. Add: 'Before stating any monetary amount, ask yourself: where exactly in my context does this number appear? If you cannot point to the exact variable it came from, do NOT say it. If the information is missing, say: I want to make sure I give you the right figures — let me have our team confirm the exact amount and call you back.'",

  accepted_vague_date:
    "DATE RESOLUTION ENGINE already defines vague phrase handling — phrases like soon, later, next week, end of month must be rejected and clarified. The agent is accepting them without resolution. Add: 'Vague date phrases are NOT valid inputs. When the customer says soon, later, sometime next week, or end of month — do NOT save. Say: I need a specific date so our team can plan for you — what exact date works? Like the 15th of June, for example? Do not move on until the customer gives a day and date you can resolve to YYYY-MM-DD.'",

  wrong_person_handling:
    "WRONG NUMBER handling is defined in the prompt with the exact redirect script. The agent either skips saveAnswers or skips the WhatsApp redirect phrase. Add emphasis: 'If the person says I am not [client_name] or this is the wrong number, you MUST: (1) say the exact phrase: I sincerely apologize for the confusion — I will make sure this is corrected — have a great day. (2) call saveAnswers with is_lead = false, call_status = not_interested, all q/a slots null. (3) ONLY after saveAnswers returns, call hangUp. Skipping saveAnswers on a wrong number is still a data failure.'",

  spoke_luganda:
    "Debt prompt rule 7 is explicit: never switch to Luganda. If customer requests it, use the redirect: Someone from our team who speaks Luganda will call you back. Add to prompt: 'If the customer speaks Luganda or asks you to speak Luganda, do NOT attempt any Luganda words or phrases. Say exactly: I'm sorry — I don't speak Luganda, but I will arrange for someone from our team who does to call you back. Then set call_status = callback_scheduled and call saveDebt.'",

  no_commitment:
    "Debt agent goal is an exact payment date — vague agreement is a failure. Add an escalation gate: 'If after 2 attempts to get a commitment date the customer still deflects (I'll call you back / I'll sort it out / maybe next week), do NOT accept it. Say: I completely understand — let me pass this to our team so they can work out a plan that suits you. Then set action = escalate, call saveDebt, and close the call. A call that ends without either a promise_date or an escalation is a failure.'",

  pushed_back:
    "Cold outreach rule 6 explicitly forbids arguing when a customer is not interested. Add: 'If the customer says not interested, no thanks, or any clear rejection — do NOT counter-offer, do NOT re-explain the product, do NOT ask why. Say exactly: I completely understand — let me just send you some details on WhatsApp in case it's useful later... have a wonderful day. Then call saveAnswers with interest = cold, call_status = not_interested, and hang up. Any re-pitch after a clear rejection is a violation.'",

  wrong_info:
    "The agent is stating property details or prices not present in context. Add: 'NEVER state a price, square footage, floor number, availability, or feature that is not explicitly written in your context. If a customer asks for a detail you cannot find in context, say: That is a great question — I want to give you the exact details, so let me have our team confirm that and follow up with you directly. Log the question in unanswered_questions. Guessing or estimating property details destroys buyer trust.'",

  wrong_call_type:
    "CALL TYPE DETECTION rule at the top of the prompt defines inbound vs outbound flow — they must never mix. This fires when an inbound call executes the outbound opening, or vice versa. Fix: Add a decision checkpoint as the very first instruction: 'Read call_type. If call_type = outbound, skip INBOUND MODE entirely. If call_type is null/empty/missing, skip OUTBOUND sections entirely. These two flows share zero steps. If you are uncertain, treat as inbound.'",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const clientFilter = params.client ?? '';
  const statusFilter = params.status ?? '';
  const errorAgent = params.eagent ?? '';
  const dateRange = params.range ?? 'all';
  const compareDate = params.compare ?? '';
  const offset = (page - 1) * PAGE_SIZE;

  const since = dateRange === '7d'
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : dateRange === '30d'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const agentPrompts = await fetchAgentPrompts();

  const [
    { count: totalCalls },
    { count: endedCount },
    { count: successfulCount },
    { count: activeCalls },
    { count: totalAnalyzed },
    { count: callsWithErrors },
    { data: aggregateRows },
  ] = await Promise.all([
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'ended').not('ended_reason', 'in', '(error,unjoined)'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).gt('error_count', 0).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('cost_usd, duration_seconds').range(0, 9999),
  ]);

  const successRate = (endedCount ?? 0) > 0 ? Math.round(((successfulCount ?? 0) / (endedCount ?? 1)) * 100) : 0;
  const totalCost = aggregateRows?.reduce((s, c) => s + (c.cost_usd || 0), 0) || 0;
  const callsWithDuration = aggregateRows?.filter((c) => (c.duration_seconds || 0) > 0) || [];
  const avgDuration = callsWithDuration.length > 0
    ? Math.round(callsWithDuration.reduce((s, c) => s + (c.duration_seconds || 0), 0) / callsWithDuration.length)
    : 0;
  const errorRate = (totalAnalyzed ?? 0) > 0 ? Math.round(((callsWithErrors ?? 0) / (totalAnalyzed ?? 1)) * 100) : 0;

  let errorQuery = supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at, duration_seconds')
    .eq('analysis_status', 'complete').gt('error_count', 0)
    .order('critical_error_count', { ascending: false }).range(0, 9999);
  if (errorAgent) errorQuery = errorQuery.eq('client_name', errorAgent);
  if (since) errorQuery = errorQuery.gt('created_at', since);
  const { data: errorCalls } = await errorQuery;

  interface ErrorFrequency {
    type: string; count: number; critical_count: number;
    example_call: string; example_line: string; agents: string[];
  }
  const freqMap = new Map<string, ErrorFrequency>();
  for (const call of errorCalls ?? []) {
    const analysis = call.call_errors as ErrorAnalysis | null;
    if (!analysis?.errors) continue;
    for (const err of analysis.errors) {
      if (!freqMap.has(err.type)) freqMap.set(err.type, { type: err.type, count: 0, critical_count: 0, example_call: call.call_id, example_line: err.agent_line ?? '', agents: [] });
      const freq = freqMap.get(err.type)!;
      freq.count++;
      if (err.severity === 'critical') freq.critical_count++;
      if (!freq.agents.includes(call.client_name)) freq.agents.push(call.client_name);
    }
  }
  const topErrors = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
  const worstCalls = [...(errorCalls ?? [])].sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0)).slice(0, 8);

  const { data: costRows } = await supabaseAdmin.from('ultravox_calls').select('call_errors, cost_usd, created_at').eq('analysis_status', 'complete').gt('error_count', 0).range(0, 9999);
  const errorCostMap: Record<string, number> = {};
  const firstCallDate = costRows?.length ? new Date(costRows[costRows.length - 1].created_at as string) : new Date();
  const weeksOfData = Math.max(1, Math.round((Date.now() - firstCallDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  for (const row of costRows ?? []) {
    const errs = (row.call_errors as ErrorAnalysis | null)?.errors ?? [];
    const cost = (row.cost_usd as number) ?? 0;
    const seen = new Set<string>();
    for (const e of errs) { if (!seen.has(e.type)) { errorCostMap[e.type] = (errorCostMap[e.type] ?? 0) + cost; seen.add(e.type); } }
  }

  const { data: fpRows } = await supabaseAdmin.from('false_positives').select('call_id, error_type');
  const fpSet = new Set((fpRows ?? []).map((r) => `${r.call_id}::${r.error_type}`));

  const { data: clientBreakdown } = await supabaseAdmin.from('ultravox_calls').select('client_name').range(0, 9999);
  const clientCounts: Record<string, number> = {};
  for (const c of clientBreakdown || []) clientCounts[c.client_name] = (clientCounts[c.client_name] || 0) + 1;
  const clients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);

  const { data: trendRaw } = await supabaseAdmin.from('ultravox_calls').select('client_name, created_at, error_count, analysis_status').eq('analysis_status', 'complete').order('created_at', { ascending: true }).range(0, 9999);
  type WeekMap = Map<string, { analyzed: number; errors: number }>;
  const trendByAgent: Record<string, WeekMap> = {};
  for (const c of trendRaw ?? []) {
    const agent = c.client_name as string;
    const d = new Date(c.created_at as string);
    const yr = d.getUTCFullYear();
    const wk = Math.ceil((((d.getTime() - new Date(yr, 0, 1).getTime()) / 86400000) + new Date(yr, 0, 1).getUTCDay() + 1) / 7);
    const key = `${yr}-W${String(wk).padStart(2, '0')}`;
    if (!trendByAgent[agent]) trendByAgent[agent] = new Map();
    const wm = trendByAgent[agent];
    if (!wm.has(key)) wm.set(key, { analyzed: 0, errors: 0 });
    const entry = wm.get(key)!;
    entry.analyzed++;
    if ((c.error_count as number ?? 0) > 0) entry.errors++;
  }
  const allWeeks = [...new Set(Object.values(trendByAgent).flatMap((wm) => [...wm.keys()]))].sort().slice(-12);
  const trendAgents = Object.keys(trendByAgent).filter((a) => a !== 'NECTOR Demo');
  const trendData = allWeeks.map((wk) => {
    const [yr, w] = wk.split('-W').map(Number);
    const approxDate = new Date(yr, 0, 1 + (w - 1) * 7);
    const label = approxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const point = { week: wk, label } as import('@/app/components/TrendChart').TrendPoint;
    for (const agent of trendAgents) {
      const entry = trendByAgent[agent]?.get(wk);
      point[agent] = entry && entry.analyzed > 0 ? Math.round((entry.errors / entry.analyzed) * 100) : 0;
    }
    return point;
  });

  interface ErrorDiff { type: string; before: number; after: number; delta: number; }
  let comparisonData: ErrorDiff[] = [];
  if (compareDate) {
    const [beforeRows, afterRows] = await Promise.all([
      supabaseAdmin.from('ultravox_calls').select('call_errors').eq('analysis_status', 'complete').gt('error_count', 0).lt('created_at', new Date(compareDate).toISOString()).range(0, 9999),
      supabaseAdmin.from('ultravox_calls').select('call_errors').eq('analysis_status', 'complete').gt('error_count', 0).gte('created_at', new Date(compareDate).toISOString()).range(0, 9999),
    ]);
    const countErrors = (rows: typeof beforeRows.data) => { const map: Record<string, number> = {}; for (const r of rows ?? []) { const errs = (r.call_errors as ErrorAnalysis | null)?.errors ?? []; for (const e of errs) map[e.type] = (map[e.type] || 0) + 1; } return map; };
    const beforeCounts = countErrors(beforeRows.data);
    const afterCounts = countErrors(afterRows.data);
    const allTypes = new Set([...Object.keys(beforeCounts), ...Object.keys(afterCounts)]);
    comparisonData = Array.from(allTypes).map(type => ({ type, before: beforeCounts[type] || 0, after: afterCounts[type] || 0, delta: (afterCounts[type] || 0) - (beforeCounts[type] || 0) })).sort((a, b) => a.delta - b.delta);
  }

  const activeAlerts = await import('@/lib/alert-engine').then((m) => m.runAlertCheck()).catch(() => [] as import('@/lib/alert-engine').FiredAlert[]);

  let query = supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  if (clientFilter) query = query.eq('client_name', clientFilter);
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data: calls, count: filteredTotal } = await query;
  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, eagent: errorAgent, range: dateRange === 'all' ? '' : dateRange, ...overrides };
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return qs ? `/?${qs}` : '/';
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const analyzed = totalAnalyzed ?? 0;
  const analysisPct = (totalCalls ?? 0) > 0 ? Math.round((analyzed / (totalCalls ?? 1)) * 100) : 0;

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="max-w-7xl mx-auto px-6 pb-16">

        {/* ── STAT STRIP ─────────────────────────────────────────────────────── */}
        <div className="py-6 border-b border-border mb-8 grid grid-cols-4 md:grid-cols-7 gap-6">
          {[
            { label: 'Total Calls', value: (totalCalls ?? 0).toLocaleString(), hi: false },
            { label: 'Success Rate', value: `${successRate}%`, hi: successRate < 70 },
            { label: 'Error Rate', value: `${errorRate}%`, hi: errorRate > 50, crit: errorRate > 70 },
            { label: 'Avg Duration', value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`, hi: false },
            { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, hi: false },
            { label: 'Analyzed', value: `${analyzed.toLocaleString()} (${analysisPct}%)`, hi: analysisPct < 50 },
            { label: 'Live Now', value: String(activeCalls ?? 0), hi: false, live: (activeCalls ?? 0) > 0 },
          ].map(({ label, value, hi, crit, live }) => (
            <div key={label}>
              <div className="text-[11px] font-medium text-ink-3 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-xl font-bold tabular-nums ${
                crit ? 'text-crit' : hi ? 'text-warn' : live ? 'text-accent' : 'text-ink'
              }`}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── ALERTS ─────────────────────────────────────────────────────────── */}
        {activeAlerts.length > 0 && (
          <div className="mb-8 rounded-xl border border-crit-border bg-crit-bg overflow-hidden">
            <div className="px-5 py-3 border-b border-crit-border flex items-center gap-2">
              <span className="text-sm font-semibold text-crit">Active Alerts</span>
              <span className="text-xs text-crit opacity-70">{activeAlerts.length} rule{activeAlerts.length > 1 ? 's' : ''} triggered</span>
            </div>
            <div className="divide-y divide-crit-border divide-opacity-40">
              {activeAlerts.map((alert, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-base shrink-0">
                    {alert.severity === 'critical' ? '🔴' : '🟡'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-ink">{alert.label}</span>
                    <span className="ml-2 text-xs text-ink-2">{alert.agent} · {alert.count} call{alert.count > 1 ? 's' : ''}</span>
                    <div className="text-xs text-ink-3 font-mono mt-0.5">
                      <Link href={`/calls/${alert.example_call_id}`} className="hover:text-accent transition-colors">
                        {alert.example_call_id.substring(0, 24)}…
                      </Link>
                    </div>
                  </div>
                  <AckAlertButton ruleId={alert.rule_id} agent={alert.agent} />
                  <span className="text-xs text-ink-3 shrink-0">{new Date(alert.fired_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR INTELLIGENCE ─────────────────────────────────────────────── */}
        <section className="mb-10">
          {/* Section header + filters */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Error Intelligence</div>
              <h2 className="text-xl font-bold text-ink leading-none">
                {topErrors.length} error type{topErrors.length !== 1 ? 's' : ''}
                <span className="text-ink-3 font-normal text-base ml-2">across {errorCalls?.length ?? 0} calls</span>
              </h2>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Agent filter */}
              <div className="flex gap-1">
                <Link href={buildUrl({ eagent: '', page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${!errorAgent ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>All</Link>
                {['Sales AI','Debt Collector','Cold Outreach'].map(a => (
                  <Link key={a} href={buildUrl({ eagent: a, page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${errorAgent === a ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>{a.split(' ')[0]}</Link>
                ))}
              </div>
              {/* Date range */}
              <div className="flex gap-1">
                {[['all','All time'],['30d','30d'],['7d','7d']].map(([v, l]) => (
                  <Link key={v} href={buildUrl({ range: v === 'all' ? '' : v, page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${(v === 'all' ? !since : dateRange === v) ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>{l}</Link>
                ))}
              </div>
            </div>
          </div>

          {topErrors.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-medium text-ink-2">No errors in selected range</div>
              <div className="text-xs text-ink-3 mt-1">All analyzed calls passed rule checks.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
              {/* Error leaderboard */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Error Leaderboard</span>
                  <div className="flex gap-4 text-[11px] text-ink-3">
                    <span>Occurrences</span>
                    <span>Cost/wk</span>
                  </div>
                </div>
                <div className="divide-y divide-border-subtle">
                  {topErrors.slice(0, 10).map((err, i) => {
                    const agentName = err.agents[0] ?? '';
                    const promptText = agentPrompts[agentName] ?? '';
                    const patches = getApplicablePatches(err.type, promptText);
                    const weekCost = errorCostMap[err.type] ? (errorCostMap[err.type] / weeksOfData) : 0;
                    return (
                      <div key={err.type} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-bold text-ink-3 w-5 shrink-0 pt-0.5 tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-ink leading-snug">
                                {HUMAN_LABELS[err.type] ?? err.type.replace(/_/g, ' ')}
                              </span>
                              {err.critical_count > 0 && (
                                <span className="px-1.5 py-0.5 text-[11px] font-medium bg-crit-bg text-crit border border-crit-border rounded-md whitespace-nowrap">
                                  {err.critical_count} critical
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-ink-3 mb-2">{err.type}</div>

                            {patches.length > 0 && (
                              <FixBlock
                                patches={patches.map((p) => ({
                                  label: p.patch.label,
                                  find: p.patch.find,
                                  replace: p.patch.replace,
                                  alreadyFixed: p.alreadyFixed,
                                }))}
                              />
                            )}

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-ink-3">
                                {err.agents.slice(0, 3).join(' · ')}
                                {err.agents.length > 3 && ` +${err.agents.length - 3}`}
                              </span>
                              <div className="flex items-center gap-3">
                                <Link href={`/calls/${err.example_call}`} className="text-xs text-accent hover:underline">
                                  example →
                                </Link>
                                <LogFixButton agentName={agentName} errorType={err.type} />
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right w-24 pt-0.5">
                            <div className="text-xl font-bold text-ink tabular-nums">{err.count}</div>
                            {weekCost > 0 && (
                              <div className="text-xs text-warn font-medium">${weekCost.toFixed(2)}/wk</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Worst calls */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border-subtle">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Most Problematic Calls</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {worstCalls.map((call) => {
                    const analysis = call.call_errors as ErrorAnalysis | null;
                    return (
                      <div key={call.call_id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/calls/${call.call_id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-ink truncate">{call.client_name}</span>
                              {(call.critical_error_count ?? 0) > 0 && (
                                <span className="px-1.5 py-0.5 text-[11px] bg-crit-bg text-crit border border-crit-border rounded-md whitespace-nowrap shrink-0">
                                  {call.critical_error_count}c
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-ink-3 mb-1">{call.call_id.substring(0, 20)}…</div>
                            {analysis?.summary && (
                              <div className="text-xs text-ink-2 line-clamp-2">{analysis.summary}</div>
                            )}
                          </Link>
                          <div className="shrink-0 text-right">
                            <div className="text-lg font-bold text-warn tabular-nums">{call.error_count}</div>
                            <div className="text-[11px] text-ink-3">errors</div>
                          </div>
                        </div>
                        {analysis?.errors && analysis.errors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {analysis.errors.map((e) => (
                              <FalsePositiveButton
                                key={e.type}
                                callId={call.call_id as string}
                                errorType={e.type}
                                isFP={fpSet.has(`${call.call_id}::${e.type}`)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── TREND CHART ─────────────────────────────────────────────────────── */}
        {trendData.length > 0 && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Error Rate Trend</div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-ink">Weekly error rate per agent</h2>
                <span className="text-xs text-ink-3">Last 12 weeks</span>
              </div>
              <TrendChart data={trendData} agents={trendAgents} />
            </div>
          </section>
        )}

        {/* ── BEFORE / AFTER ───────────────────────────────────────────────────── */}
        {compareDate ? (
          <section className="mb-10 bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-0.5">Before / After Comparison</div>
                <span className="text-sm font-medium text-ink">Fix applied: {compareDate}</span>
              </div>
              <Link href="/" className="text-xs text-ink-3 hover:text-ink transition-colors">Clear ✕</Link>
            </div>
            {comparisonData.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-ink-3">No analyzed calls found around that date.</div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {comparisonData.map(d => {
                  const improved = d.delta < 0;
                  const worsened = d.delta > 0;
                  const pct = d.before > 0 ? Math.round(((d.after - d.before) / d.before) * 100) : d.after > 0 ? 100 : 0;
                  return (
                    <div key={d.type} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-mono text-ink">{d.type}</span>
                        {HUMAN_LABELS[d.type] && <span className="text-xs text-ink-3 ml-2">{HUMAN_LABELS[d.type]}</span>}
                      </div>
                      <div className="flex items-center gap-6 text-sm shrink-0">
                        <span className="text-ink-3 w-20 text-right">Before: <strong className="text-ink">{d.before}</strong></span>
                        <span className="text-ink-3 w-20 text-right">After: <strong className="text-ink">{d.after}</strong></span>
                        <span className={`w-16 text-right font-semibold ${improved ? 'text-ok' : worsened ? 'text-crit' : 'text-ink-3'}`}>
                          {improved ? '▼' : worsened ? '▲' : '—'} {Math.abs(pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <div className="mb-8 text-xs text-ink-3">
            Add <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded border border-border text-ink-2">?compare=YYYY-MM-DD</code> to compare error rates before and after a prompt fix.
          </div>
        )}

        {/* ── ALL CALLS ────────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Call Log</div>
              <h2 className="text-xl font-bold text-ink leading-none">
                {clientFilter || 'All'} Calls
                <span className="text-ink-3 font-normal text-base ml-2">{filteredTotal?.toLocaleString()}</span>
              </h2>
            </div>
            {/* Client filters */}
            <div className="flex flex-wrap gap-1 justify-end">
              <Link href={buildUrl({ client: '', page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${!clientFilter ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>
                All ({totalCalls})
              </Link>
              {clients.slice(0, 6).map(([name, count]) => (
                <Link key={name} href={buildUrl({ client: name, page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${clientFilter === name ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>
                  {name} ({count})
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-5 py-2.5 border-b border-border-subtle">
              {['Agent / ID', 'Status', 'Duration', 'Errors', 'Date'].map(h => (
                <span key={h} className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-border-subtle">
              {calls?.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="text-sm text-ink-2 font-medium mb-1">No calls yet</div>
                  <div className="text-xs text-ink-3">Run <code className="font-mono bg-surface-2 px-1 rounded">npm run sync</code> to fetch from Ultravox.</div>
                </div>
              )}
              {calls?.map((call) => {
                const isUnjoined = call.ended_reason === 'unjoined';
                const isError = call.ended_reason?.includes('error');
                const dur = call.duration_seconds || 0;
                const hasErrors = (call.error_count ?? 0) > 0;
                const hasCritical = (call.critical_error_count ?? 0) > 0;
                const noTranscript = isUnjoined || dur < 5;

                return (
                  <Link
                    key={call.call_id}
                    href={`/calls/${call.call_id}`}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] px-5 py-3 hover:bg-surface-2 transition-colors items-center gap-4"
                  >
                    {/* Agent + ID */}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{call.client_name}</div>
                      <div className="text-[11px] font-mono text-ink-3 truncate">{call.call_id}</div>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                        isUnjoined ? 'bg-surface-2 text-ink-3 border-border'
                          : isError ? 'bg-crit-bg text-crit border-crit-border'
                          : call.status === 'active' ? 'bg-accent-bg text-accent border-accent-border'
                          : 'bg-ok-bg text-ok border-ok-border'
                      }`}>
                        {call.status}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="text-xs text-ink-2 tabular-nums whitespace-nowrap">
                      {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}
                    </div>

                    {/* Errors */}
                    <div className="text-right">
                      {hasCritical ? (
                        <span className="text-xs font-semibold text-crit tabular-nums">{call.critical_error_count}c / {call.error_count}</span>
                      ) : hasErrors ? (
                        <span className="text-xs font-medium text-warn tabular-nums">{call.error_count}</span>
                      ) : noTranscript && call.analysis_status === 'pending' ? (
                        <span className="text-[11px] text-ink-3">—</span>
                      ) : call.analysis_status === 'complete' ? (
                        <span className="text-xs text-ok">✓</span>
                      ) : (
                        <span className="text-[11px] text-ink-3">{call.analysis_status ?? '—'}</span>
                      )}
                    </div>

                    {/* Date */}
                    <div className="text-xs text-ink-3 whitespace-nowrap">
                      {new Date(call.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between">
                <span className="text-xs text-ink-3">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 text-xs border border-border rounded-md text-ink-2 hover:border-ink-3 transition-colors">← Prev</Link>
                  )}
                  {page < totalPages && (
                    <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 text-xs border border-border rounded-md text-ink-2 hover:border-ink-3 transition-colors">Next →</Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
