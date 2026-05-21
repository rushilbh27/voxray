import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendChart } from '@/app/components/TrendChart';
import { AckAlertButton } from '@/app/components/AckAlertButton';
import { Nav } from '@/app/components/Nav';
import { PipelineStrip } from '@/app/components/PipelineStrip';

export const revalidate = 60;

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  client?: string;
  status?: string;
}


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
  const offset = (page - 1) * PAGE_SIZE;

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
    { data: clientRows },
    { data: weeklyRows },
    { data: pipelineRows },
    { data: agentSummaryRows },
    activeAlerts,
    { data: calls, count: filteredTotal },
  ] = await Promise.all([
    supabaseAdmin.rpc('get_dashboard_aggregates'),
    supabaseAdmin.rpc('get_client_breakdown'),
    supabaseAdmin.rpc('get_weekly_trend'),
    supabaseAdmin.rpc('get_pipeline_stats'),
    supabaseAdmin.rpc('get_agent_error_summary'),
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

  // ── Agent summary for grid ──────────────────────────────────────────────────
  interface AgentSummary {
    client_name: string;
    total_calls: number;
    analyzed_calls: number;
    calls_with_errors: number;
    error_rate: number;
    critical_count: number;
    top_error_type: string | null;
  }
  const agentSummaries: AgentSummary[] = (agentSummaryRows ?? []).map((row: Record<string, unknown>) => ({
    client_name:      row.client_name as string,
    total_calls:      Number(row.total_calls),
    analyzed_calls:   Number(row.analyzed_calls),
    calls_with_errors: Number(row.calls_with_errors),
    error_rate:       Number(row.error_rate ?? 0),
    critical_count:   Number(row.critical_count),
    top_error_type:   (row.top_error_type as string) ?? null,
  }));

  // Build agent_id lookup from a distinct query
  const { data: agentIdRows } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name, agent_id')
    .not('agent_id', 'is', null)
    .limit(2000);
  const agentIdMap = new Map<string, string>();
  for (const r of (agentIdRows ?? []) as Array<Record<string, unknown>>) {
    const name = r.client_name as string;
    const aid = r.agent_id as string;
    if (name && aid && !agentIdMap.has(name)) agentIdMap.set(name, aid);
  }

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

  // ── AI pipeline stats ────────────────────────────────────────────────────────
  const pipelineStats = (pipelineRows as Array<Record<string, unknown>> | null)?.[0] ?? null;

  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, ...overrides };
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

        {/* ── AGENT GRID ──────────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-1.5">Agent Intelligence</div>
              <h2 className="text-2xl font-black text-ink leading-none">
                {agentSummaries.length} <span className="font-normal text-ink-3 text-lg">agent{agentSummaries.length !== 1 ? 's' : ''}</span>
                <span className="text-ink-3 font-normal text-sm ml-3">Click an agent for errors, patches & fixes</span>
              </h2>
            </div>
          </div>

          {agentSummaries.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl px-6 py-12 text-center">
              <div className="text-2xl mb-2">—</div>
              <div className="text-sm font-medium text-ink-2">No agents found</div>
              <div className="text-xs text-ink-3 mt-1">Run sync to populate call data.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agentSummaries.map((agent) => {
                const aid = agentIdMap.get(agent.client_name);
                const href = aid ? `/dashboard/${aid}` : '#';
                return (
                  <Link
                    key={agent.client_name}
                    href={href}
                    className="bg-surface border border-border rounded-xl p-5 hover:border-accent hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-ink group-hover:text-accent transition-colors">{agent.client_name}</h3>
                        {agent.top_error_type && (
                          <div className="text-[11px] font-mono text-ink-3 mt-0.5">
                            Top: {agent.top_error_type.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                      {agent.critical_count > 0 && (
                        <span className="px-1.5 py-0.5 text-[11px] font-medium bg-crit-bg text-crit border border-crit-border rounded-md">
                          {agent.critical_count} critical
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-ink-3 uppercase tracking-wider">Calls</div>
                        <div className="text-lg font-bold text-ink tabular-nums">{agent.total_calls}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-3 uppercase tracking-wider">Error Rate</div>
                        <div className={`text-lg font-bold tabular-nums ${agent.error_rate > 50 ? 'text-crit' : agent.error_rate > 30 ? 'text-warn' : 'text-ink'}`}>
                          {agent.error_rate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-3 uppercase tracking-wider">Errors</div>
                        <div className={`text-lg font-bold tabular-nums ${agent.calls_with_errors > 0 ? 'text-warn' : 'text-ok'}`}>
                          {agent.calls_with_errors}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-ink-3">
                      {agent.analyzed_calls} / {agent.total_calls} analyzed
                      <span className="ml-2 text-accent opacity-0 group-hover:opacity-100 transition-opacity">View errors →</span>
                    </div>
                  </Link>
                );
              })}
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
