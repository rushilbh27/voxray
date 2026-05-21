import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { fetchAgentPrompts } from '@/lib/ultravox';
import { getApplicablePatches, getAgentPatches } from '@/lib/fix-specs';
import { FixBlock } from '@/app/components/FixBlock';
import { TrendChart } from '@/app/components/TrendChart';
import { LogFixButton } from '@/app/components/LogFixButton';
import { AckAlertButton } from '@/app/components/AckAlertButton';
import { FalsePositiveButton } from '@/app/components/FalsePositiveButton';
import { Nav } from '@/app/components/Nav';
import { PipelineStrip } from '@/app/components/PipelineStrip';
import { EvalBadge } from '@/app/components/EvalBadge';
import { ApplyFixButton } from '@/app/components/ApplyFixButton';
import { ErrorVelocitySparkline } from '@/app/components/ErrorVelocitySparkline';
import type { VelocityPoint } from '@/app/components/ErrorVelocitySparkline';
import { ReanalyzeButton } from '@/app/components/ReanalyzeButton';

// Agent name → Ultravox UUID (apply-fix allowlist checks UUID server-side)
const AGENT_IDS: Record<string, string> = {
  'NECTOR Demo':      '428d7591-3ba5-4b60-8aa5-a92012d12451',
  'Sales AI':         '65ae3d7d-5a1f-4880-89f4-1ce690efae89',
  'Debt Collector':   '52db715f-fc68-4265-a354-7f64a27cd3b9',
  'Cold Outreach':    '74c435db-0382-45d4-8f84-65343c0dde5f',
};
import { PromptVersionChart } from '@/app/components/PromptVersionChart';
import type { VersionPoint } from '@/app/components/PromptVersionChart';

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

  // ── Build the paginated call-log query (filter-dependent) ─────────────────
  let callLogQuery = supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, status, ended_reason, duration_seconds, error_count, critical_error_count, analysis_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (clientFilter) callLogQuery = callLogQuery.eq('client_name', clientFilter);
  if (statusFilter) callLogQuery = callLogQuery.eq('status', statusFilter);

  // ── Single parallel fetch — everything at once ────────────────────────────
  const [
    { data: aggRows },
    { data: errorFreqRows },
    { data: clientRows },
    { data: weeklyRows },
    { data: worstCallsRaw },
    { data: fpRows },
    { data: pipelineRows },
    { data: evalRows },
    { data: velocityRows },
    agentPrompts,
    activeAlerts,
    { data: calls, count: filteredTotal },
  ] = await Promise.all([
    supabaseAdmin.rpc('get_dashboard_aggregates'),
    supabaseAdmin.rpc('get_error_frequency', {
      p_since: since ?? null,
      p_agent: errorAgent || null,
    }),
    supabaseAdmin.rpc('get_client_breakdown'),
    supabaseAdmin.rpc('get_weekly_trend'),
    supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, call_errors, error_count, critical_error_count')
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .order('critical_error_count', { ascending: false })
      .limit(8),
    supabaseAdmin.from('false_positives').select('call_id, error_type'),
    supabaseAdmin.rpc('get_pipeline_stats'),
    supabaseAdmin.rpc('get_eval_stats'),
    supabaseAdmin.rpc('get_error_velocity'),
    fetchAgentPrompts(),
    import('@/lib/alert-engine').then((m) => m.runAlertCheck()).catch(() => [] as import('@/lib/alert-engine').FiredAlert[]),
    callLogQuery,
  ]);

  // ── Stat strip ──────────────────────────────────────────────────────────────
  const agg = aggRows?.[0] as Record<string, unknown> | undefined;
  const totalCalls      = Number(agg?.total_calls ?? 0);
  const endedCount      = Number(agg?.ended_count ?? 0);
  const successfulCount = Number(agg?.successful_count ?? 0);
  const activeCalls     = Number(agg?.active_calls ?? 0);
  const totalAnalyzed   = Number(agg?.total_analyzed ?? 0);
  const callsWithErrors = Number(agg?.calls_with_errors ?? 0);
  const totalCost       = Number(agg?.total_cost ?? 0);
  const avgDuration     = Math.round(Number(agg?.avg_duration ?? 0));
  const successRate     = endedCount > 0 ? Math.round((successfulCount / endedCount) * 100) : 0;
  const errorRate       = totalAnalyzed > 0 ? Math.round((callsWithErrors / totalAnalyzed) * 100) : 0;

  // ── Error leaderboard ───────────────────────────────────────────────────────
  interface ErrorFrequency {
    type: string; count: number; critical_count: number; cost_usd: number;
    example_call: string; example_line: string; agents: string[];
  }
  const topErrors: ErrorFrequency[] = (errorFreqRows ?? []).map((row: Record<string, unknown>) => ({
    type:           row.error_type as string,
    count:          Number(row.count),
    critical_count: Number(row.critical_count),
    cost_usd:       Number(row.cost_usd),
    example_call:   row.example_call_id as string,
    example_line:   (row.example_line as string) ?? '',
    agents:         (row.agents as string[]) ?? [],
  }));

  // Cost per week — derive from first week in trend data
  const firstWeekStr = (weeklyRows as Array<Record<string, unknown>> | null)?.[0]?.week as string | undefined;
  const weeksOfData = firstWeekStr
    ? Math.max(1, Math.round(
        (Date.now() - new Date(firstWeekStr.replace(/(\d{4})-W(\d{2})/, (_, y, w) =>
          new Date(Number(y), 0, 1 + (Number(w) - 1) * 7).toISOString().slice(0, 10)
        )).getTime()) / (7 * 24 * 60 * 60 * 1000)
      ))
    : 1;

  const worstCalls = worstCallsRaw ?? [];
  const fpSet = new Set((fpRows ?? []).map((r) => `${r.call_id}::${r.error_type}`));

  // ── Client breakdown for filter pills ──────────────────────────────────────
  const clients = (clientRows as Array<Record<string, unknown>> ?? []).map(
    (r) => [r.client_name as string, Number(r.count)] as [string, number]
  );

  // ── Trend chart ─────────────────────────────────────────────────────────────
  type WeekMap = Map<string, { analyzed: number; errors: number }>;
  const trendByAgent: Record<string, WeekMap> = {};
  for (const row of (weeklyRows as Array<Record<string, unknown>> ?? [])) {
    const agent = row.agent as string;
    const wk    = row.week as string;
    if (!trendByAgent[agent]) trendByAgent[agent] = new Map();
    trendByAgent[agent].set(wk, {
      analyzed: Number(row.analyzed),
      errors:   Number(row.errors),
    });
  }
  const allWeeks    = [...new Set(Object.values(trendByAgent).flatMap((wm) => [...wm.keys()]))].sort().slice(-12);
  const trendAgents = Object.keys(trendByAgent).filter((a) => a !== 'NECTOR Demo');
  const trendData   = allWeeks.map((wk) => {
    const [yr, w] = wk.split('-W').map(Number);
    const approxDate = new Date(yr, 0, 1 + (w - 1) * 7);
    const label      = approxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const point      = { week: wk, label } as import('@/app/components/TrendChart').TrendPoint;
    for (const agent of trendAgents) {
      const entry = trendByAgent[agent]?.get(wk);
      point[agent] = entry && entry.analyzed > 0 ? Math.round((entry.errors / entry.analyzed) * 100) : 0;
    }
    return point;
  });

  // ── Error velocity map: errorType → sorted weekly points ─────────────────────
  const velocityMap = new Map<string, VelocityPoint[]>();
  for (const row of (velocityRows as Array<Record<string, unknown>>) ?? []) {
    const type  = row.error_type as string;
    const week  = row.week as string;
    const count = Number(row.count);
    if (!velocityMap.has(type)) velocityMap.set(type, []);
    velocityMap.get(type)!.push({ week, count });
  }

  // ── AI pipeline stats ────────────────────────────────────────────────────────
  const pipelineStats = (pipelineRows as Array<Record<string, unknown>> | null)?.[0] ?? null;

  // ── Eval map (FP rate per error type) ────────────────────────────────────────
  const evalMap = new Map<string, { total_flags: number; fp_count: number }>(
    ((evalRows as Array<Record<string, unknown>>) ?? []).map((r) => [
      r.error_type as string,
      { total_flags: Number(r.total_flags), fp_count: Number(r.fp_count) },
    ])
  );

  // ── Conditional queries (parallel with each other) ───────────────────────────
  const [pvResult, compResult] = await Promise.all([
    errorAgent
      ? supabaseAdmin.rpc('get_prompt_version_trend', { p_agent: errorAgent })
      : Promise.resolve({ data: null }),
    compareDate
      ? supabaseAdmin.rpc('get_comparison_data', { p_date: new Date(compareDate).toISOString() })
      : Promise.resolve({ data: null }),
  ]);

  const promptVersionData: VersionPoint[] = ((pvResult.data as Array<Record<string, unknown>>) ?? []).map((r) => ({
    prompt_hash: r.prompt_hash as string,
    first_used:  r.first_used as string,
    total:       Number(r.total),
    with_errors: Number(r.with_errors),
  }));

  interface ErrorDiff { type: string; before: number; after: number; delta: number; }
  const comparisonData: ErrorDiff[] = ((compResult.data as Array<Record<string, unknown>>) ?? [])
    .map((r) => ({
      type:   r.error_type as string,
      before: Number(r.before_count),
      after:  Number(r.after_count),
      delta:  Number(r.after_count) - Number(r.before_count),
    }))
    .sort((a, b) => a.delta - b.delta);

  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, eagent: errorAgent, range: dateRange === 'all' ? '' : dateRange, ...overrides };
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return qs ? `/dashboard?${qs}` : '/dashboard';
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const analyzed = totalAnalyzed;
  const analysisPct = totalCalls > 0 ? Math.round((analyzed / totalCalls) * 100) : 0;

  return (
    <div className="min-h-screen bg-canvas">
      <Nav activeCalls={activeCalls} />

      <main className="max-w-7xl mx-auto px-6 pb-16">

        {/* ── STAT STRIP ─────────────────────────────────────────────────────── */}
        <div className="py-6 border-b border-border mb-8 grid grid-cols-4 md:grid-cols-7 gap-6">
          {[
            { label: 'Total Calls',   value: (totalCalls ?? 0).toLocaleString(), hi: false },
            { label: 'Success Rate',  value: `${successRate}%`,                  hi: successRate < 70 },
            { label: 'Error Rate',    value: `${errorRate}%`,                    hi: errorRate > 50, crit: errorRate > 70 },
            { label: 'Avg Duration',  value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`, hi: false },
            { label: 'Total Cost',    value: `$${totalCost.toFixed(2)}`,          hi: false },
            { label: 'Analyzed',      value: `${analyzed.toLocaleString()} (${analysisPct}%)`, hi: analysisPct < 50 },
            { label: 'Live Now',      value: String(activeCalls ?? 0),            hi: false, live: (activeCalls ?? 0) > 0 },
          ].map(({ label, value, hi, crit, live }) => (
            <div key={label}>
              <div className="text-[11px] font-medium text-ink-3 uppercase tracking-wider mb-1.5">{label}</div>
              <div className={`tabular-nums font-bold leading-none ${
                crit
                  ? 'text-3xl font-black text-crit'
                  : hi
                    ? 'text-2xl text-warn'
                    : live
                      ? 'text-2xl text-accent'
                      : 'text-2xl text-ink'
              }`}>
                {live && (activeCalls ?? 0) > 0
                  ? <span className="inline-flex items-center gap-1.5">{value}<span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /></span>
                  : value}
              </div>
            </div>
          ))}
        </div>

        {/* ── AI PIPELINE STRIP ──────────────────────────────────────────────── */}
        <PipelineStrip stats={pipelineStats as Parameters<typeof PipelineStrip>[0]['stats']} />

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
              <h2 className="text-2xl font-black text-ink leading-none">
                {topErrors.length} <span className="font-normal text-ink-3 text-lg">error type{topErrors.length !== 1 ? 's' : ''}</span>
                <span className="text-ink-3 font-normal text-sm ml-3">{callsWithErrors.toLocaleString()} calls affected</span>
              </h2>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
              {/* Re-analyze when agent filter active */}
              {errorAgent && AGENT_IDS[errorAgent] && (
                <ReanalyzeButton
                  agentId={AGENT_IDS[errorAgent]}
                  agentName={errorAgent}
                  limit={30}
                />
              )}
              {/* Agent filter — primary workflow */}
              <div className="flex gap-1">
                <Link href={buildUrl({ eagent: '', page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${!errorAgent ? 'bg-ink text-surface border-ink' : 'border-border text-ink-2 hover:border-ink-3'}`}>All agents</Link>
                {['Sales AI','Debt Collector','Cold Outreach','NECTOR Demo'].map(a => (
                  <Link key={a} href={buildUrl({ eagent: a, page: '1' })} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${errorAgent === a ? 'bg-accent text-white border-accent' : 'border-border text-ink-2 hover:border-ink-3'}`}>{a.replace(' AI','').replace(' Demo','').replace('Debt ','')}</Link>
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
                {!errorAgent && (
                  <div className="px-5 py-4 bg-surface-2 border-b border-border-subtle">
                    <p className="text-xs text-ink-3">Select an agent above to see fix patches and apply fixes. Each agent has a different prompt.</p>
                  </div>
                )}
                <div className="divide-y divide-border-subtle">
                  {topErrors.slice(0, 10).map((err, i) => {
                    // When agent filter active: check patches for THAT agent only
                    // When no filter: no patches (force user to pick agent)
                    const targetAgent = errorAgent || '';
                    const targetPrompt = agentPrompts[targetAgent] ?? '';
                    const patches = targetAgent ? getApplicablePatches(err.type, targetPrompt) : [];
                    const hasApplicable = patches.some((p) => !p.alreadyFixed);
                    const weekCost = err.cost_usd ? (err.cost_usd / weeksOfData) : 0;
                    // Apply button: only when agent filter is active AND find text exists in that agent's prompt
                    const canApply = errorAgent && AGENT_IDS[errorAgent] === '428d7591-3ba5-4b60-8aa5-a92012d12451' && hasApplicable;
                    return (
                      <div key={err.type} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="text-sm font-bold text-ink-3 w-5 shrink-0 pt-0.5 tabular-nums">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-sm font-medium text-ink leading-snug">
                                {HUMAN_LABELS[err.type] ?? err.type.replace(/_/g, ' ')}
                              </span>
                              {err.critical_count > 0 && (
                                <span className="px-1.5 py-0.5 text-[11px] font-medium bg-crit-bg text-crit border border-crit-border rounded-md whitespace-nowrap">
                                  {err.critical_count} critical
                                </span>
                              )}
                              {(() => {
                                const ev = evalMap.get(err.type);
                                return ev && ev.total_flags >= 5
                                  ? <EvalBadge totalFlags={ev.total_flags} fpCount={ev.fp_count} />
                                  : null;
                              })()}
                            </div>
                            <div className="text-xs font-mono text-ink-3 mb-2">{err.type}</div>

                            {/* Per-agent patches — only when agent filter active */}
                            {errorAgent && patches.length > 0 && (
                              <div>
                                <div className="text-[11px] text-ink-3 mb-1">
                                  Patch for <span className="font-semibold text-ink-2">{errorAgent}</span>
                                  {hasApplicable
                                    ? <span className="text-ok ml-1">· find text verified ✓</span>
                                    : <span className="text-warn ml-1">· all patches already applied</span>
                                  }
                                </div>
                                <FixBlock
                                  patches={patches.map((p) => ({
                                    label: p.patch.label,
                                    find: p.patch.find,
                                    replace: p.patch.replace,
                                    alreadyFixed: p.alreadyFixed,
                                  }))}
                                />
                              </div>
                            )}

                            {/* No patches found for this agent — show text suggestion */}
                            {errorAgent && patches.length === 0 && FIX_SUGGESTIONS[err.type] && (
                              <details className="mt-1 text-xs">
                                <summary className="text-ink-3 cursor-pointer hover:text-ink-2">
                                  No patch for {errorAgent} — view suggestion
                                </summary>
                                <p className="mt-1 text-ink-2 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                                  {FIX_SUGGESTIONS[err.type].slice(0, 400)}…
                                </p>
                              </details>
                            )}

                            <div className="flex items-center justify-between mt-2">
                              {!errorAgent ? (
                                <span className="text-xs text-ink-3">
                                  {err.agents.slice(0, 3).join(' · ')}
                                  {err.agents.length > 3 && ` +${err.agents.length - 3}`}
                                </span>
                              ) : (
                                <span className="text-xs text-ink-2 font-medium">{errorAgent}</span>
                              )}
                              <div className="flex items-center gap-3 flex-wrap">
                                <Link href={`/calls/${err.example_call}`} className="text-xs text-accent hover:underline">
                                  example →
                                </Link>
                                <LogFixButton agentName={errorAgent || err.agents[0] || ''} errorType={err.type} />
                                {canApply && (
                                  <ApplyFixButton
                                    agentId="428d7591-3ba5-4b60-8aa5-a92012d12451"
                                    agentName="NECTOR Demo"
                                    errorType={err.type}
                                    description={`Dashboard apply: ${err.type}`}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right w-28 pt-0.5">
                            <div className="text-xl font-bold text-ink tabular-nums mb-1">{err.count}</div>
                            <div className="flex justify-end">
                              <ErrorVelocitySparkline data={velocityMap.get(err.type) ?? []} />
                            </div>
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
                            {analysis.errors.map((e, ei) => (
                              <FalsePositiveButton
                                key={`${e.type}-${ei}`}
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

        {/* ── PROMPT VERSION CHART ─────────────────────────────────────────────── */}
        {errorAgent && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Prompt Version Impact</div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-ink">Error rate by prompt version · {errorAgent}</h2>
                <p className="text-xs text-ink-3 mt-0.5">Each bar = one distinct prompt hash. Most recent = rightmost.</p>
              </div>
              <PromptVersionChart data={promptVersionData} agent={errorAgent} />
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
              <Link href="/dashboard" className="text-xs text-ink-3 hover:text-ink transition-colors">Clear ✕</Link>
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
