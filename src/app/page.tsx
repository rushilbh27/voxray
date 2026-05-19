import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { fetchAgentPrompts } from '@/lib/ultravox';
import { getApplicablePatches } from '@/lib/fix-specs';
import { FixBlock } from '@/app/components/FixBlock';
import { TrendChart } from '@/app/components/TrendChart';

export const revalidate = 60;

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  client?: string;
  status?: string;
  eagent?: string;  // error section agent filter
  range?: string;   // error section date range: 7d | 30d | all
}

const HUMAN_LABELS: Record<string, string> = {
  accepted_unknown_location: 'Agent accepted an unrecognizable area name (cannot recognize area)',
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
  wrong_call_type:          'Executed wrong call flow (inbound treated as outbound or vice versa)',
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
  if (!user) {
    redirect('/login');
  }
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const clientFilter = params.client ?? '';
  const statusFilter = params.status ?? '';
  const errorAgent = params.eagent ?? '';
  const dateRange = params.range ?? 'all';
  const offset = (page - 1) * PAGE_SIZE;

  const since = dateRange === '7d'
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : dateRange === '30d'
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  // Fetch current agent prompts from Ultravox (cached 5 min) for smart fix checks
  const agentPrompts = await fetchAgentPrompts();

  // All metrics in one query
  // Use parallel count queries (no row-transfer overhead) + a single range fetch
  // for cost/duration aggregates. Avoids the Supabase 1000-row default cap.
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
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true })
      .eq('status', 'ended')
      .not('ended_reason', 'in', '(error,unjoined)'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).gt('error_count', 0).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('cost_usd, duration_seconds').range(0, 9999),
  ]);

  const successRate = (endedCount ?? 0) > 0
    ? Math.round(((successfulCount ?? 0) / (endedCount ?? 1)) * 100)
    : 0;
  const totalCost = aggregateRows?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
  const callsWithDuration = aggregateRows?.filter((c) => (c.duration_seconds || 0) > 0) || [];
  const avgDuration = callsWithDuration.length > 0
    ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length)
    : 0;
  const errorRate = (totalAnalyzed ?? 0) > 0
    ? Math.round(((callsWithErrors ?? 0) / (totalAnalyzed ?? 1)) * 100)
    : 0;

  // Error intelligence data — filtered by agent + date range
  let errorQuery = supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at, duration_seconds')
    .eq('analysis_status', 'complete')
    .gt('error_count', 0)
    .order('critical_error_count', { ascending: false })
    .range(0, 9999);
  if (errorAgent) errorQuery = errorQuery.eq('client_name', errorAgent);
  if (since) errorQuery = errorQuery.gt('created_at', since);
  const { data: errorCalls } = await errorQuery;

  interface ErrorFrequency {
    type: string;
    count: number;
    critical_count: number;
    example_call: string;
    example_line: string;
    agents: string[];
  }

  const freqMap = new Map<string, ErrorFrequency>();
  for (const call of errorCalls ?? []) {
    const analysis = call.call_errors as ErrorAnalysis | null;
    if (!analysis?.errors) continue;
    for (const err of analysis.errors) {
      if (!freqMap.has(err.type)) {
        freqMap.set(err.type, {
          type: err.type,
          count: 0,
          critical_count: 0,
          example_call: call.call_id,
          example_line: err.agent_line ?? '',
          agents: [],
        });
      }
      const freq = freqMap.get(err.type)!;
      freq.count++;
      if (err.severity === 'critical') freq.critical_count++;
      if (!freq.agents.includes(call.client_name)) freq.agents.push(call.client_name);
    }
  }

  const topErrors = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
  const worstCalls = [...(errorCalls ?? [])]
    .sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0))
    .slice(0, 8);

  // Client breakdown — all rows
  const { data: clientBreakdown } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name')
    .range(0, 9999);
  const clientCounts: Record<string, number> = {};
  for (const c of clientBreakdown || []) {
    clientCounts[c.client_name] = (clientCounts[c.client_name] || 0) + 1;
  }
  const clients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);

  // Trend data — weekly error rate per agent (last 12 weeks, analyzed calls only)
  const { data: trendRaw } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name, created_at, error_count, analysis_status')
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: true })
    .range(0, 9999);

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

  // Build chart-ready array (last 12 weeks across all agents)
  const allWeeks = [...new Set(
    Object.values(trendByAgent).flatMap((wm) => [...wm.keys()])
  )].sort().slice(-12);

  const trendAgents = Object.keys(trendByAgent).filter((a) => a !== 'NECTOR Demo');
  const trendData = allWeeks.map((wk) => {
    const [yr, w] = wk.split('-W').map(Number);
    const approxDate = new Date(yr, 0, 1 + (w - 1) * 7);
    const label = approxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const point = { week: wk, label } as import('@/app/components/TrendChart').TrendPoint;
    for (const agent of trendAgents) {
      const entry = trendByAgent[agent]?.get(wk);
      point[agent] = entry && entry.analyzed > 0
        ? Math.round((entry.errors / entry.analyzed) * 100)
        : 0;
    }
    return point;
  });

  // Alert check — run silently, catch errors so dashboard never breaks
  const activeAlerts = await import('@/lib/alert-engine')
    .then((m) => m.runAlertCheck())
    .catch(() => [] as import('@/lib/alert-engine').FiredAlert[]);

  // Paginated call list
  let query = supabaseAdmin
    .from('ultravox_calls')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (clientFilter) query = query.eq('client_name', clientFilter);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data: calls, count: filteredTotal } = await query;
  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, eagent: errorAgent, range: dateRange === 'all' ? '' : dateRange, ...overrides };
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return qs ? `/?${qs}` : '/';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Voxray</h1>
            <p className="text-gray-500 mt-1">X-ray vision for your voice agents</p>
          </div>
          <form action="/api/logout" method="POST">
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200 hover:border-gray-400 transition-colors">
              Sign out
            </button>
          </form>
        </div>

        {/* ── SECTION 1: METRICS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { label: 'Total Calls', value: (totalCalls ?? 0).toLocaleString(), color: 'text-gray-900' },
            { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-600' },
            { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, color: 'text-gray-900' },
            {
              label: 'Avg Duration',
              value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`,
              color: 'text-gray-900',
            },
            { label: 'Active Now', value: String(activeCalls ?? 0), color: 'text-blue-600' },
            { label: 'Analyzed', value: String(totalAnalyzed ?? 0), color: 'text-gray-700' },
            {
              label: 'Error Rate',
              value: `${errorRate}%`,
              color: errorRate > 50 ? 'text-red-600' : errorRate > 25 ? 'text-orange-500' : 'text-green-600',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg shadow p-4">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── ACTIVE ALERTS BANNER ── */}
        {activeAlerts.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 overflow-hidden">
            <div className="px-4 py-2.5 bg-red-100 border-b border-red-200 flex items-center gap-2">
              <span className="text-red-700 font-bold text-sm">⚡ Active Alerts</span>
              <span className="text-xs text-red-500">{activeAlerts.length} rule{activeAlerts.length > 1 ? 's' : ''} triggered in the last few hours</span>
            </div>
            <div className="divide-y divide-red-100">
              {activeAlerts.map((alert, i) => (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5">
                    {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-red-900">{alert.label}</span>
                    <span className="ml-2 text-xs text-red-600">
                      {alert.agent} · {alert.count} call{alert.count > 1 ? 's' : ''}
                    </span>
                    <div className="text-xs text-red-500 font-mono mt-0.5">
                      example: <Link href={`/calls/${alert.example_call_id}`} className="underline hover:text-red-700">{alert.example_call_id.substring(0, 20)}…</Link>
                    </div>
                  </div>
                  <span className="text-xs text-red-400 shrink-0">
                    {new Date(alert.fired_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TREND CHART ── */}
        {trendData.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Error Rate Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">Weekly error rate per agent (analyzed calls)</p>
              </div>
              <div className="flex gap-2">
                <a
                  href="/api/v1/export?type=errors"
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
                >
                  ↓ Export errors CSV
                </a>
                <a
                  href="/api/v1/export?type=worst_calls"
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
                >
                  ↓ Export worst calls CSV
                </a>
              </div>
            </div>
            <TrendChart data={trendData} agents={trendAgents} />
          </div>
        )}

        {/* ── SECTION 2: ERROR INTELLIGENCE ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Error Intelligence</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {errorCalls?.length ?? 0} calls with errors · {topErrors.length} error types
                {(errorAgent || dateRange !== 'all') && (
                  <span className="text-blue-500"> (filtered)</span>
                )}
              </p>
            </div>
            <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1">
              {totalAnalyzed ?? 0} analyzed
            </span>
          </div>

          {/* Error filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {/* Agent filter */}
            {(['', ...clients.map(([n]) => n)] as string[]).map((name) => (
              <Link
                key={name || '__all__'}
                href={buildUrl({ eagent: name, page: '1' })}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  errorAgent === name
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {name || 'All agents'}
              </Link>
            ))}
            <span className="w-px h-5 bg-gray-200 self-center mx-1" />
            {/* Date range filter */}
            {(['all', '30d', '7d'] as const).map((r) => (
              <Link
                key={r}
                href={buildUrl({ range: r === 'all' ? '' : r, page: '1' })}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  dateRange === r
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {r === 'all' ? 'All time' : `Last ${r}`}
              </Link>
            ))}
          </div>

          {topErrors.length === 0 ? (
            <div className="bg-white rounded-lg shadow px-6 py-12 text-center text-gray-400">
              No errors detected yet. Run{' '}
              <code className="font-mono">npm run analyze</code> to start.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">

              {/* Top errors leaderboard */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Most Common Errors</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {topErrors.slice(0, 8).map((err, i) => (
                    <div key={err.type} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-sm font-bold text-gray-300 shrink-0 w-5 pt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-0.5">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 leading-snug">
                                {HUMAN_LABELS[err.type] ?? err.type.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs font-mono text-gray-400 mt-0.5">
                                {err.type}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-lg font-bold text-gray-700">{err.count}</div>
                              {err.critical_count > 0 && (
                                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full whitespace-nowrap">
                                  {err.critical_count} critical
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Structured Find → Replace fix */}
                          {(() => {
                            // Use first affected agent's current prompt for staleness check
                            const agentName = err.agents[0] ?? '';
                            const promptText = agentPrompts[agentName] ?? '';
                            const patches = getApplicablePatches(err.type, promptText);
                            if (patches.length === 0) return null;
                            return (
                              <FixBlock
                                patches={patches.map((p) => ({
                                  label: p.patch.label,
                                  find: p.patch.find,
                                  replace: p.patch.replace,
                                  alreadyFixed: p.alreadyFixed,
                                }))}
                              />
                            );
                          })()}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-400">
                              {err.agents.slice(0, 3).join(' · ')}
                              {err.agents.length > 3 && ` +${err.agents.length - 3}`}
                            </span>
                            <Link
                              href={`/calls/${err.example_call}`}
                              className="text-xs text-blue-500 hover:underline"
                            >
                              see example →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worst calls */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Most Problematic Calls</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {worstCalls.map((call) => {
                    const analysis = call.call_errors as ErrorAnalysis | null;
                    return (
                      <Link
                        key={call.call_id}
                        href={`/calls/${call.call_id}`}
                        className="px-5 py-3 flex items-start justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-900">
                              {call.client_name}
                            </span>
                            {(call.critical_error_count ?? 0) > 0 && (
                              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                                {call.critical_error_count} critical
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {call.call_id.substring(0, 20)}…
                          </div>
                          {analysis?.summary && (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {analysis.summary}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold text-orange-600">{call.error_count}</div>
                          <div className="text-xs text-gray-400">errors</div>
                          <div className="text-xs text-gray-400">
                            {new Date(call.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 3: ALL CALLS ── */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">All Calls</h2>

          {/* Client filter pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Link
              href={buildUrl({ client: '', page: '1' })}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                !clientFilter
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              All ({totalCalls})
            </Link>
            {clients.map(([name, count]) => (
              <Link
                key={name}
                href={buildUrl({ client: name, page: '1' })}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  clientFilter === name
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {name} ({count})
              </Link>
            ))}
          </div>

          {/* Call list */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {clientFilter || 'All'} Calls
              </h3>
              <span className="text-sm text-gray-400">
                {filteredTotal?.toLocaleString()} total · page {page} of {totalPages || 1}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {calls?.length === 0 && (
                <div className="px-6 py-12 text-center text-gray-400">
                  No calls found. Run <code className="font-mono">npm run sync</code> to fetch data.
                </div>
              )}
              {calls?.map((call) => {
                const isUnjoined = call.ended_reason === 'unjoined';
                const isError = call.ended_reason?.includes('error');
                const badgeClass = isUnjoined
                  ? 'bg-gray-100 text-gray-500'
                  : isError
                    ? 'bg-red-100 text-red-800'
                    : call.status === 'active'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800';
                const dur = call.duration_seconds || 0;
                const hasErrors = (call.error_count ?? 0) > 0;
                const hasCritical = (call.critical_error_count ?? 0) > 0;
                const noTranscript = isUnjoined || dur < 5; // unjoined or <5s = no real transcript
                return (
                  <Link
                    key={call.call_id}
                    href={`/calls/${call.call_id}`}
                    className="px-6 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}>
                          {call.status}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {call.client_name}
                        </span>
                        {hasCritical && (
                          <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                            {call.critical_error_count} critical
                          </span>
                        )}
                        {hasErrors && !hasCritical && (
                          <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                            {call.error_count} errors
                          </span>
                        )}
                        {noTranscript && !hasErrors && call.analysis_status === 'pending' && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-400 rounded-full">
                            no transcript
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 font-mono truncate">{call.call_id}</div>
                      {call.ended_reason && (
                        <div className="mt-0.5 text-xs text-gray-500">
                          Ended: {call.ended_reason}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
                      <div className="font-medium text-gray-700">
                        {Math.floor(dur / 60)}m {dur % 60}s
                      </div>
                      <div className="text-xs">${(call.cost_usd || 0).toFixed(3)}</div>
                      <div className="text-xs mt-0.5 text-gray-400">
                        {new Date(call.created_at).toLocaleDateString()}{' '}
                        {new Date(call.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <Link
                  href={buildUrl({ page: String(Math.max(1, page - 1)) })}
                  className={`px-4 py-2 text-sm rounded-md border ${
                    page <= 1
                      ? 'text-gray-300 border-gray-200 pointer-events-none'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ← Previous
                </Link>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <Link
                        key={p}
                        href={buildUrl({ page: String(p) })}
                        className={`w-8 h-8 flex items-center justify-center text-sm rounded-md ${
                          p === page
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href={buildUrl({ page: String(Math.min(totalPages, page + 1)) })}
                  className={`px-4 py-2 text-sm rounded-md border ${
                    page >= totalPages
                      ? 'text-gray-300 border-gray-200 pointer-events-none'
                      : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Next →
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
