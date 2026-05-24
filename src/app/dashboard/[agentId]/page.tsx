import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAgent } from '@/lib/ultravox';
import { getApplicablePatches } from '@/lib/fix-specs';
import { FixBlock } from '@/app/components/FixBlock';
import { Nav } from '@/app/components/Nav';
import { ApplyFixButton } from '@/app/components/ApplyFixButton';
import { ReanalyzeButton } from '@/app/components/ReanalyzeButton';
import { LogFixButton } from '@/app/components/LogFixButton';
import { FalsePositiveButton } from '@/app/components/FalsePositiveButton';
import { EvalBadge } from '@/app/components/EvalBadge';
import { ErrorVelocitySparkline } from '@/app/components/ErrorVelocitySparkline';
import type { VelocityPoint } from '@/app/components/ErrorVelocitySparkline';
import { PromptVersionChart } from '@/app/components/PromptVersionChart';
import type { VersionPoint } from '@/app/components/PromptVersionChart';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { FIX_SPECS } from '@/lib/fix-specs';
import { PromptViewer } from './PromptViewer';
import { ApplyAllFixesButton } from './ApplyAllFixesButton';
import { LiveTracker } from '@/app/components/LiveTracker';
import { ErrorHeatmap } from '@/app/components/ErrorHeatmap';
import { OutcomeChart } from '@/app/components/OutcomeChart';
import { buildHeatmapRows } from '@/lib/heatmap-utils';
import { buildOutcomeData } from '@/lib/outcome-utils';
import { CompareForm } from './CompareForm';

export const revalidate = 60;

const ALLOWED_AGENT_IDS = [
  '428d7591-3ba5-4b60-8aa5-a92012d12451', // NECTOR Demo
  '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81', // Davansh Investment
];

// DB client_name → human display name (some agents have inconsistent raw names)
const DISPLAY_NAMES: Record<string, string> = {
  'Sales_AI':                         'Sales AI',
  'Debt-Collector-Agent-UG':          'Debt Collector',
  'Debt_Collection_2':                'Debt Collection 2',
  'Cold_Outreach_AI':                 'Cold Outreach AI',
  'NECTOR_DEMO_TEST':                 'NECTOR Demo',
  'Davansh_Investment_inbound':       'Davansh Investment',
  'Edifice_Properties_inbound':       'Edifice Properties',
  'Shell Gas Uganda':                 'Ramco Gas',
  'Ramco_Gas_inbound':                'Ramco Gas',
  'Real_Estate_AI_Sales_Agent':       'Real Estate AI',
  'Follow_Up_Debt_Collection_Bot':    'Debt Follow-Up Bot',
  'Debt_Collection_Welcome-Bot':      'Debt Welcome Bot',
};

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

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { agentId } = await params;
  const { compare: compareDate } = await searchParams;

  // Resolve agentId → client_name from DB
  const { data: nameRow } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name')
    .eq('agent_id', agentId)
    .limit(1)
    .single();

  const clientName = nameRow?.client_name ?? 'Unknown Agent';
  const displayName = DISPLAY_NAMES[clientName] ?? clientName;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const twelveWeeksAgo = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel fetch: agent prompt, errors, stats, worst calls, eval, velocity, prompt versions, heatmap, outcome
  const [
    agent,
    { data: errorFreqRows },
    { data: worstCallsRaw },
    { data: evalRows },
    { data: velocityRows },
    { data: pvData },
    { data: fpRows },
    { data: aggRows },
    { data: heatmapCalls },
    { data: outcomeCalls },
    { data: beforeCalls },
    { data: afterCalls },
  ] = await Promise.all([
    fetchAgent(agentId),
    supabaseAdmin.rpc('get_error_frequency', {
      p_since: null,
      p_agent: clientName,
    }),
    supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, customer_name, call_errors, error_count, critical_error_count, created_at')
      .eq('agent_id', agentId)
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .order('critical_error_count', { ascending: false })
      .limit(8),
    supabaseAdmin.rpc('get_eval_stats'),
    supabaseAdmin.rpc('get_error_velocity'),
    supabaseAdmin.rpc('get_prompt_version_trend', { p_agent: clientName }),
    supabaseAdmin.from('false_positives').select('call_id, error_type'),
    supabaseAdmin
      .from('ultravox_calls')
      .select('analysis_status, error_count, critical_error_count', { count: 'exact', head: false })
      .eq('agent_id', agentId)
      .eq('status', 'ended')
      .limit(5000),
    // Heatmap: last 30 days of calls with errors
    supabaseAdmin
      .from('ultravox_calls')
      .select('created_at, call_errors')
      .eq('agent_id', agentId)
      .eq('analysis_status', 'complete')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true })
      .limit(500),
    // Outcome trend: last 12 weeks
    supabaseAdmin
      .from('ultravox_calls')
      .select('created_at, call_errors')
      .eq('agent_id', agentId)
      .eq('analysis_status', 'complete')
      .gte('created_at', twelveWeeksAgo)
      .order('created_at', { ascending: true })
      .limit(1000),
    // Before: calls before compareDate
    compareDate
      ? supabaseAdmin.from('ultravox_calls').select('call_errors').eq('agent_id', agentId).eq('analysis_status', 'complete').lt('created_at', compareDate).limit(2000)
      : Promise.resolve({ data: null, error: null }),
    // After: calls on/after compareDate
    compareDate
      ? supabaseAdmin.from('ultravox_calls').select('call_errors').eq('agent_id', agentId).eq('analysis_status', 'complete').gte('created_at', compareDate).limit(2000)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const prompt = agent?.systemPrompt ?? '';
  const isAllowlisted = ALLOWED_AGENT_IDS.includes(agentId);

  // Compute agent-level stats from aggRows
  const allCalls = aggRows ?? [];
  const totalCalls = allCalls.length;
  const analyzedCalls = allCalls.filter((r: Record<string, unknown>) => r.analysis_status === 'complete').length;
  const callsWithErrors = allCalls.filter((r: Record<string, unknown>) => (r.error_count as number) > 0).length;
  const criticalCount = allCalls.reduce((sum: number, r: Record<string, unknown>) => sum + ((r.critical_error_count as number) ?? 0), 0);
  const errorRate = analyzedCalls > 0 ? Math.round((callsWithErrors / analyzedCalls) * 100) : 0;

  // Error leaderboard
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

  // Eval map
  const evalMap = new Map<string, { total_flags: number; fp_count: number }>(
    ((evalRows as Array<Record<string, unknown>>) ?? []).map((r) => [
      r.error_type as string,
      { total_flags: Number(r.total_flags), fp_count: Number(r.fp_count) },
    ])
  );

  // Velocity map
  const velocityMap = new Map<string, VelocityPoint[]>();
  for (const row of (velocityRows as Array<Record<string, unknown>>) ?? []) {
    const type  = row.error_type as string;
    const week  = row.week as string;
    const count = Number(row.count);
    if (!velocityMap.has(type)) velocityMap.set(type, []);
    velocityMap.get(type)!.push({ week, count });
  }

  // Prompt version data
  const promptVersionData: VersionPoint[] = ((pvData as Array<Record<string, unknown>>) ?? []).map((r) => ({
    prompt_hash: r.prompt_hash as string,
    first_used:  r.first_used as string,
    total:       Number(r.total),
    with_errors: Number(r.with_errors),
  }));

  const worstCalls = worstCallsRaw ?? [];
  const fpSet = new Set((fpRows ?? []).map((r) => `${r.call_id}::${r.error_type}`));

  // Heatmap + outcome data
  const heatmapRows = buildHeatmapRows(heatmapCalls ?? []);
  const outcomeData = buildOutcomeData(outcomeCalls ?? []);

  // Before/after comparison — compute in JS from two date-range queries
  interface CompareRow { error_type: string; before_count: number; after_count: number }
  const compareData: CompareRow[] | null = (() => {
    if (!compareDate || !beforeCalls || !afterCalls) return null;
    const countErrors = (calls: Array<{ call_errors: unknown }>) => {
      const counts = new Map<string, number>();
      for (const call of calls) {
        const errors = (call.call_errors as { errors?: Array<{ type: string }> } | null)?.errors ?? [];
        const seen = new Set<string>();
        for (const e of errors) {
          if (!seen.has(e.type)) { seen.add(e.type); counts.set(e.type, (counts.get(e.type) ?? 0) + 1); }
        }
      }
      return counts;
    };
    const before = countErrors(beforeCalls);
    const after = countErrors(afterCalls);
    const allTypes = new Set([...before.keys(), ...after.keys()]);
    return [...allTypes]
      .map((t) => ({ error_type: t, before_count: before.get(t) ?? 0, after_count: after.get(t) ?? 0 }))
      .filter((r) => r.before_count > 0 || r.after_count > 0)
      .sort((a, b) => b.before_count - a.before_count);
  })();

  // Collect all fixable error types for "Apply All" button
  const fixableErrors: string[] = [];
  for (const err of topErrors) {
    const patches = getApplicablePatches(err.type, prompt);
    if (patches.some((p) => !p.alreadyFixed)) {
      fixableErrors.push(err.type);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Nav activeCalls={0} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <LiveTracker />
        {/* Breadcrumb + header */}
        <div className="py-6 border-b border-border mb-8">
          <Link href="/dashboard" className="text-xs text-ink-3 hover:text-accent transition-colors">
            ← Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink leading-none">{displayName}</h1>
              <div className="text-xs font-mono text-ink-3 mt-1 break-all sm:break-normal">{agentId}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ReanalyzeButton agentId={agentId} limit={30} />
              {isAllowlisted && fixableErrors.length > 0 && (
                <ApplyAllFixesButton
                  agentId={agentId}
                  agentName={displayName}
                  errorTypes={fixableErrors}
                />
              )}
            </div>
          </div>
        </div>

        {/* Agent stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          {[
            { label: 'Total Calls', value: totalCalls.toLocaleString() },
            { label: 'Analyzed', value: String(analyzedCalls) },
            { label: 'Error Rate', value: `${errorRate}%`, warn: errorRate > 50 },
            { label: 'With Errors', value: String(callsWithErrors), warn: callsWithErrors > 0 },
            { label: 'Critical', value: String(criticalCount), crit: criticalCount > 0 },
          ].map(({ label, value, warn, crit }) => (
            <div key={label} className="bg-surface border border-border rounded-xl px-4 py-3">
              <div className="text-[11px] font-medium text-ink-3 uppercase tracking-wider mb-1">{label}</div>
              <div className={`text-2xl font-bold tabular-nums ${crit ? 'text-crit' : warn ? 'text-warn' : 'text-ink'}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* No prompt warning */}
        {!prompt && (
          <div className="mb-8 bg-warn-bg border border-warn-border rounded-xl px-5 py-4">
            <div className="text-sm font-medium text-warn">No prompt loaded</div>
            <div className="text-xs text-ink-3 mt-1">Could not fetch system prompt from Ultravox API for this agent. Patch verification unavailable.</div>
          </div>
        )}

        {/* Error Intelligence */}
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Error Intelligence</div>
              <h2 className="text-xl sm:text-2xl font-black text-ink leading-none">
                {topErrors.length} <span className="font-normal text-ink-3 text-lg">error type{topErrors.length !== 1 ? 's' : ''}</span>
                <span className="text-ink-3 font-normal text-sm ml-3">{callsWithErrors} calls affected</span>
              </h2>
            </div>
            {isAllowlisted && (
              <span className="text-xs px-2.5 py-1 bg-accent-bg text-accent border border-accent-border rounded-md font-medium self-start sm:self-auto">
                Auto-fix enabled
              </span>
            )}
          </div>

          {topErrors.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-sm font-medium text-ink-2">No errors detected</div>
              <div className="text-xs text-ink-3 mt-1">All analyzed calls passed rule checks for this agent.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
              {/* Error leaderboard with per-agent verified patches */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Errors for {displayName}</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {topErrors.slice(0, 15).map((err, i) => {
                    // Always get patches — even without prompt, show spec for manual copy
                    const patches = prompt
                      ? getApplicablePatches(err.type, prompt)
                      : (FIX_SPECS[err.type]?.patches ?? []).map((patch) => ({
                          patch,
                          alreadyFixed: false,
                          verification: { exists: false, lineNumber: 0, contextBefore: '', contextAfter: '' },
                        }));
                    const hasApplicable = prompt ? patches.some((p) => !p.alreadyFixed) : false;
                    const canApply = isAllowlisted && hasApplicable;

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

                            {/* Verified patches — always shown for manual copy */}
                            {patches.length > 0 && (
                              <div>
                                {prompt && (
                                  <div className="text-[11px] text-ink-3 mb-1">
                                    {hasApplicable ? (
                                      <>
                                        <span className="text-ok">✓ find text verified in prompt</span>
                                        {patches.filter(p => !p.alreadyFixed).map((p) => (
                                          <span key={p.patch.label} className="ml-2 text-ink-3">
                                            · line {p.verification.lineNumber}
                                          </span>
                                        ))}
                                      </>
                                    ) : (
                                      <span className="text-warn">✓ All patches already applied to this agent</span>
                                    )}
                                  </div>
                                )}
                                {!prompt && (
                                  <div className="text-[11px] text-ink-3 mb-1">
                                    <span className="text-warn">Prompt unavailable — copy snippets below for manual apply</span>
                                  </div>
                                )}
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

                            {/* No patches for this error type */}
                            {patches.length === 0 && (
                              <div className="text-xs text-ink-3 mt-1">
                                No structured patch available for this error type.
                              </div>
                            )}

                            {/* Transcript example */}
                            {err.example_line && (
                              <div className="mt-3 mb-1 px-3 py-2 bg-canvas border border-border-subtle rounded-lg">
                                <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-1">Agent said</div>
                                <div className="text-xs text-ink-2 italic leading-snug">&quot;{err.example_line}&quot;</div>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Link href={`/calls/${err.example_call}`} className="text-xs text-accent hover:underline">
                                  full call →
                                </Link>
                                <LogFixButton agentName={displayName} errorType={err.type} />
                                {canApply && (
                                  <ApplyFixButton
                                    agentId={agentId}
                                    agentName={displayName}
                                    errorType={err.type}
                                    description={`Agent profile apply: ${err.type}`}
                                  />
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-lg font-bold text-ink tabular-nums">{err.count}</div>
                                <ErrorVelocitySparkline data={velocityMap.get(err.type) ?? []} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Worst calls for this agent */}
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border-subtle">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Most Problematic Calls</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {worstCalls.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-ink-3">No errors found for this agent.</div>
                  )}
                  {worstCalls.map((call) => {
                    const analysis = call.call_errors as ErrorAnalysis | null;
                    const customerName = (call as Record<string, unknown>).customer_name as string | null;
                    const callDate = (call as Record<string, unknown>).created_at as string | null;
                    return (
                      <div key={call.call_id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/calls/${call.call_id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-mono text-ink-3">{(call.call_id as string).substring(0, 20)}…</span>
                              {customerName && (
                                <span className="text-[11px] font-medium text-ink-2 bg-surface-2 px-1.5 py-0.5 rounded">
                                  {customerName}
                                </span>
                              )}
                              {callDate && (
                                <span className="text-[10px] text-ink-3">
                                  {new Date(callDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
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

        {/* Error Heatmap — 30-day calendar */}
        <section className="mb-10">
          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Error Heatmap · Last 30 Days</div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-ink">Which days errors fired · {displayName}</h2>
              <p className="text-xs text-ink-3 mt-0.5">Each square = one day. Darker = more calls with that error. Patterns reveal systematic issues.</p>
            </div>
            {heatmapRows.length > 0 ? (
              <ErrorHeatmap rows={heatmapRows} />
            ) : (
              <div className="py-8 text-center">
                <div className="text-sm font-medium text-ok mb-1">✓ No errors in the last 30 days</div>
                <div className="text-xs text-ink-3">All calls analyzed cleanly — no recurring patterns to show.</div>
              </div>
            )}
          </div>
        </section>

        {/* Goal Outcome Trend */}
        <section className="mb-10">
          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Call Outcome Trend · 12 Weeks</div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">Success rate over time · {displayName}</h2>
                <p className="text-xs text-ink-3 mt-0.5">Success rate drops here signal problems before error count spikes.</p>
              </div>
            </div>
            <OutcomeChart data={outcomeData} />
          </div>
        </section>

        {/* Before/After Comparison */}
        <section className="mb-10">
          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Before / After Fix Comparison</div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Error rate change after a prompt fix</h2>
                <p className="text-xs text-ink-3 mt-0.5">Pick the date you applied a fix to see before/after error counts.</p>
              </div>
              <CompareForm agentId={agentId} currentCompare={compareDate} />
            </div>
            {compareData && compareData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {compareData.map((row) => {
                  const before = row.before_count;
                  const after = row.after_count;
                  const change = before > 0 ? Math.round(((after - before) / before) * 100) : 0;
                  const improved = change < 0;
                  return (
                    <div key={row.error_type} className="bg-surface-2 rounded-lg p-3">
                      <div className="text-xs font-medium text-ink mb-2">{HUMAN_LABELS[row.error_type] ?? row.error_type}</div>
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-lg font-bold text-ink-2 tabular-nums">{before}</div>
                          <div className="text-[10px] text-ink-3">before {compareDate}</div>
                        </div>
                        <div className="text-ink-3">→</div>
                        <div>
                          <div className="text-lg font-bold text-ink tabular-nums">{after}</div>
                          <div className="text-[10px] text-ink-3">after</div>
                        </div>
                        {before > 0 && (
                          <div className={`ml-auto text-sm font-bold tabular-nums ${improved ? 'text-ok' : 'text-crit'}`}>
                            {improved ? '' : '+'}{change}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : compareDate ? (
              <div className="text-sm text-ink-3 text-center py-4">No comparison data for {compareDate}. Make sure calls exist both before and after this date.</div>
            ) : (
              <div className="text-sm text-ink-3 text-center py-4">Pick a date above to see how a prompt fix changed error rates.</div>
            )}
          </div>
        </section>

        {/* Prompt Version Chart */}
        {promptVersionData.length > 0 && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Prompt Version Impact</div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-ink">Error rate by prompt version · {clientName}</h2>
                <p className="text-xs text-ink-3 mt-0.5">Each bar = one distinct prompt hash. Most recent = rightmost.</p>
              </div>
              <PromptVersionChart data={promptVersionData} agent={displayName} />
            </div>
          </section>
        )}

        {/* Prompt Viewer */}
        {prompt && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">System Prompt</div>
            <PromptViewer prompt={prompt} agentName={displayName} />
          </section>
        )}
      </main>
    </div>
  );
}
