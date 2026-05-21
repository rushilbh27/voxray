import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { fetchAgent } from '@/lib/ultravox';
import { getApplicablePatches, verifyPatch } from '@/lib/fix-specs';
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
import { PromptViewer } from './PromptViewer';
import { ApplyAllFixesButton } from './ApplyAllFixesButton';

export const revalidate = 60;

const NECTOR_DEMO_ID = '428d7591-3ba5-4b60-8aa5-a92012d12451';

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
}: {
  params: Promise<{ agentId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { agentId } = await params;

  // Resolve agentId → client_name from DB
  const { data: nameRow } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name')
    .eq('agent_id', agentId)
    .limit(1)
    .single();

  const clientName = nameRow?.client_name ?? 'Unknown Agent';

  // Parallel fetch: agent prompt, errors, stats, worst calls, eval, velocity, prompt versions
  const [
    agent,
    { data: errorFreqRows },
    { data: statsRow },
    { data: worstCallsRaw },
    { data: evalRows },
    { data: velocityRows },
    { data: pvData },
    { data: fpRows },
    { data: aggRows },
  ] = await Promise.all([
    fetchAgent(agentId),
    supabaseAdmin.rpc('get_error_frequency', {
      p_since: null,
      p_agent: clientName,
    }),
    supabaseAdmin
      .from('ultravox_calls')
      .select('call_id', { count: 'exact', head: false })
      .eq('agent_id', agentId)
      .eq('status', 'ended')
      .limit(0),
    supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, call_errors, error_count, critical_error_count')
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
      .select('analysis_status, error_count, critical_error_count')
      .eq('agent_id', agentId)
      .eq('status', 'ended'),
  ]);

  const prompt = agent?.systemPrompt ?? '';
  const isAllowlisted = agentId === NECTOR_DEMO_ID;

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

      <main className="max-w-7xl mx-auto px-6 pb-16">
        {/* Breadcrumb + header */}
        <div className="py-6 border-b border-border mb-8">
          <Link href="/dashboard" className="text-xs text-ink-3 hover:text-accent transition-colors">
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between mt-3">
            <div>
              <h1 className="text-3xl font-black text-ink leading-none">{clientName}</h1>
              <div className="text-xs font-mono text-ink-3 mt-1">{agentId}</div>
            </div>
            <div className="flex items-center gap-3">
              <ReanalyzeButton agentId={agentId} agentName={clientName} limit={30} />
              {isAllowlisted && fixableErrors.length > 0 && (
                <ApplyAllFixesButton
                  agentId={agentId}
                  agentName={clientName}
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
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Error Intelligence</div>
              <h2 className="text-2xl font-black text-ink leading-none">
                {topErrors.length} <span className="font-normal text-ink-3 text-lg">error type{topErrors.length !== 1 ? 's' : ''}</span>
                <span className="text-ink-3 font-normal text-sm ml-3">{callsWithErrors} calls affected</span>
              </h2>
            </div>
            {isAllowlisted && (
              <span className="text-xs px-2.5 py-1 bg-accent-bg text-accent border border-accent-border rounded-md font-medium">
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
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Errors for {clientName}</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {topErrors.slice(0, 15).map((err, i) => {
                    const patches = prompt ? getApplicablePatches(err.type, prompt) : [];
                    const hasApplicable = patches.some((p) => !p.alreadyFixed);
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

                            {/* Verified patches */}
                            {patches.length > 0 && (
                              <div>
                                <div className="text-[11px] text-ink-3 mb-1">
                                  {hasApplicable ? (
                                    <>
                                      <span className="text-ok">✓ find text verified</span>
                                      {patches.filter(p => !p.alreadyFixed).map((p) => (
                                        <span key={p.patch.label} className="ml-2 text-ink-3">
                                          Line {p.verification.lineNumber}
                                        </span>
                                      ))}
                                    </>
                                  ) : (
                                    <span className="text-warn">All patches already applied</span>
                                  )}
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

                            {/* No patches for this error type */}
                            {patches.length === 0 && prompt && (
                              <div className="text-xs text-ink-3 mt-1">
                                No structured patch available for this error type on {clientName}.
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Link href={`/calls/${err.example_call}`} className="text-xs text-accent hover:underline">
                                  example →
                                </Link>
                                <LogFixButton agentName={clientName} errorType={err.type} />
                                {canApply && (
                                  <ApplyFixButton
                                    agentId={agentId}
                                    agentName={clientName}
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
                    return (
                      <div key={call.call_id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/calls/${call.call_id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <div className="text-[11px] font-mono text-ink-3 mb-1">{(call.call_id as string).substring(0, 24)}…</div>
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

        {/* Prompt Version Chart */}
        {promptVersionData.length > 0 && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Prompt Version Impact</div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-ink">Error rate by prompt version · {clientName}</h2>
                <p className="text-xs text-ink-3 mt-0.5">Each bar = one distinct prompt hash. Most recent = rightmost.</p>
              </div>
              <PromptVersionChart data={promptVersionData} agent={clientName} />
            </div>
          </section>
        )}

        {/* Prompt Viewer */}
        {prompt && (
          <section className="mb-10">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">System Prompt</div>
            <PromptViewer prompt={prompt} agentName={clientName} />
          </section>
        )}
      </main>
    </div>
  );
}
