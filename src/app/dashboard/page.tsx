import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendChart } from '@/app/components/TrendChart';
import { AckAlertButton } from '@/app/components/AckAlertButton';
import { Nav } from '@/app/components/Nav';
import { PipelineStrip } from '@/app/components/PipelineStrip';
import { LiveTracker } from '@/app/components/LiveTracker';
import { CountUp } from '@/app/components/CountUp';
import { Reveal } from '@/app/components/Reveal';
import { Sparkline } from '@/app/components/Sparkline';

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

  let callLogQuery = supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, status, ended_reason, duration_seconds, error_count, critical_error_count, analysis_status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (clientFilter) callLogQuery = callLogQuery.eq('client_name', clientFilter);
  if (statusFilter) callLogQuery = callLogQuery.eq('status', statusFilter);

  const [
    { data: aggRows },
    { data: clientRows },
    { data: weeklyRows },
    { data: pipelineRows },
    { data: agentSummaryRows },
    { data: agentIdRows },
    activeAlerts,
    { data: calls, count: filteredTotal },
  ] = await Promise.all([
    supabaseAdmin.rpc('get_dashboard_aggregates'),
    supabaseAdmin.rpc('get_client_breakdown'),
    supabaseAdmin.rpc('get_weekly_trend'),
    supabaseAdmin.rpc('get_pipeline_stats'),
    supabaseAdmin.rpc('get_agent_error_summary'),
    supabaseAdmin
      .from('ultravox_calls')
      .select('client_name, agent_id')
      .not('agent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
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
  const criticalTotal   = activeAlerts.reduce((n, a) => n + (a.severity === 'critical' ? 1 : 0), 0);

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

  const KNOWN_AGENT_IDS: Record<string, string> = {
    'Sales AI':                        '65ae3d7d-5a1f-4880-89f4-1ce690efae89',
    'Debt Collector':                  '52db715f-fc68-4265-a354-7f64a27cd3b9',
    'Cold Outreach':                   '74c435db-0382-45d4-8f84-65343c0dde5f',
    'NECTOR Demo':                     '428d7591-3ba5-4b60-8aa5-a92012d12451',
    'Davansh_Investment_inbound':      '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81',
    'Edifice_Properties_inbound':      'bfea3820-a447-4444-bd41-53ff919bbfe3',
    'Shell Gas Uganda':                '5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1',
    'Ramco_Gas_inbound':               '5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1',
    'Real_Estate_AI_Sales_Agent':      'efecb97c-2937-4507-a550-8db5e8882c82',
    'Debt_Collection_2':               '4be98966-7c89-4149-8f10-e2ac16291f66',
    'Follow_Up_Debt_Collection_Bot':   '3983f5c0-4a95-42e3-a95a-9dbe57e11c78',
    'Debt_Collection_Welcome-Bot':     '2dfe90c6-569f-49e0-84f4-e67d9e770255',
  };

  const DISPLAY_NAMES: Record<string, string> = {
    'Sales_AI': 'Sales AI',
    'Debt-Collector-Agent-UG': 'Debt Collector',
    'Cold_Outreach_AI': 'Cold Outreach',
    'NECTOR_DEMO_TEST': 'NECTOR Demo',
    'Davansh_Investment_inbound': 'Davansh Investment',
    'Edifice_Properties_inbound': 'Edifice Properties',
    'Shell Gas Uganda': 'Ramco Gas',
    'Ramco_Gas_inbound': 'Ramco Gas',
    'Real_Estate_AI_Sales_Agent': 'Real Estate AI',
    'Debt_Collection_2': 'Debt Collection 2',
    'Follow_Up_Debt_Collection_Bot': 'Follow-up Debt',
    'Debt_Collection_Welcome-Bot': 'Debt Welcome',
  };

  const EXCLUDED_CLIENTS = new Set(['Unknown', 'Acme Corp', 'Uganda Communications Commission', '']);

  const agentIdMap = new Map<string, string>(Object.entries(KNOWN_AGENT_IDS));
  for (const r of (agentIdRows ?? []) as Array<Record<string, unknown>>) {
    const name = r.client_name as string;
    const aid = r.agent_id as string;
    if (name && aid) agentIdMap.set(name, aid);
  }

  const summaryNames = new Set(agentSummaries.map((s) => s.client_name));
  for (const [name, count] of (clientRows as Array<Record<string, unknown>> ?? []).map(
    (r) => [r.client_name as string, Number(r.count)] as [string, number]
  )) {
    if (name && !EXCLUDED_CLIENTS.has(name) && !summaryNames.has(name)) {
      summaryNames.add(name);
      agentSummaries.push({
        client_name: name,
        total_calls: count,
        analyzed_calls: 0,
        calls_with_errors: 0,
        error_rate: 0,
        critical_count: 0,
        top_error_type: null,
      });
    }
  }
  const filteredSummaries = agentSummaries.filter((s) => !EXCLUDED_CLIENTS.has(s.client_name));
  agentSummaries.length = 0;
  agentSummaries.push(...filteredSummaries);
  agentSummaries.sort((a, b) => b.total_calls - a.total_calls || b.error_rate - a.error_rate);

  const clients = (clientRows as Array<Record<string, unknown>> ?? []).map(
    (r) => [r.client_name as string, Number(r.count)] as [string, number]
  );

  // ── Trend per agent (used by chart + per-card sparkline) ────────────────────
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

  function sparkFor(agentName: string): number[] {
    const wm = trendByAgent[agentName];
    if (!wm) return [];
    return allWeeks.slice(-8).map((wk) => {
      const e = wm.get(wk);
      return e && e.analyzed > 0 ? Math.round((e.errors / e.analyzed) * 100) : 0;
    });
  }

  const pipelineStats = (pipelineRows as Array<Record<string, unknown>> | null)?.[0] ?? null;
  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, ...overrides };
    const qs = Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return qs ? `/dashboard?${qs}` : '/dashboard';
  }

  const analyzed = totalAnalyzed;
  const analysisPct = totalCalls > 0 ? Math.round((analyzed / totalCalls) * 100) : 0;
  const totalAgents = agentSummaries.length;
  const errorRateTone = errorRate > 60 ? 'text-crit' : errorRate > 40 ? 'text-warn' : 'text-ink';
  const errorRateAccent = errorRate > 60 ? 'var(--color-crit)' : errorRate > 40 ? 'var(--color-warn)' : 'var(--color-accent)';
  const formatDur = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;
  const display = (raw: string) => DISPLAY_NAMES[raw] ?? raw.replace(/[_-]+/g, ' ');

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Nav activeCalls={activeCalls} />

      <main className="relative">
        <LiveTracker />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden border-b border-border-subtle">
          <div className="glow-bg" />
          <div className="grid-bg" />

          <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-12">
            <Reveal>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                  Voice Agent Observatory
                </span>
                <span className="h-px flex-1 max-w-[120px] bg-border-strong" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3 nums">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <h1 className="text-[42px] md:text-[56px] font-black tracking-[-0.03em] leading-[0.95] mb-4 max-w-4xl">
                <span className="text-ink-2">Monitoring</span>{' '}
                <span className="text-ink">{totalAgents} agents</span>{' '}
                <span className="text-ink-2">across</span>{' '}
                <span className="text-accent">{totalCalls.toLocaleString()}</span>{' '}
                <span className="text-ink-2">calls.</span>
              </h1>

              <p className="text-[15px] text-ink-3 max-w-2xl leading-relaxed">
                {criticalTotal > 0
                  ? `${criticalTotal} critical alert${criticalTotal > 1 ? 's' : ''} firing now. Click an agent to apply verified prompt patches.`
                  : activeAlerts.length > 0
                    ? `${activeAlerts.length} alerts active. Burst rules tracking error spikes across agents.`
                    : 'No alerts firing. Pipeline analyzing calls within seconds of completion.'}
              </p>
            </Reveal>

            {/* Primary KPI deck */}
            <Reveal delay={0.15} selector="[data-kpi]" stagger={0.08} className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3">
              <KpiPrimary
                label="Error rate"
                value={errorRate}
                suffix="%"
                tone={errorRateTone}
                accent={errorRateAccent}
                support={`${callsWithErrors.toLocaleString()} of ${analyzed.toLocaleString()} analyzed`}
                emphasis
              />
              <KpiPrimary
                label="Live now"
                value={activeCalls}
                tone="text-accent"
                accent="var(--color-accent)"
                support={activeCalls > 0 ? 'Calls in flight · webhook armed' : 'Idle · webhook ready'}
                live={activeCalls > 0}
              />
              <KpiPrimary
                label="Critical alerts"
                value={criticalTotal}
                tone={criticalTotal > 0 ? 'text-crit' : 'text-ink'}
                accent={criticalTotal > 0 ? 'var(--color-crit)' : 'var(--color-ok)'}
                support={criticalTotal > 0 ? 'Action required' : 'All clear'}
              />
            </Reveal>

            {/* Secondary metric row */}
            <Reveal delay={0.35} selector="[data-mini]" stagger={0.04} className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-px rounded-xl overflow-hidden border border-border-subtle bg-border-subtle">
              {[
                { label: 'Total calls',  value: totalCalls.toLocaleString() },
                { label: 'Success rate', value: `${successRate}%` },
                { label: 'Avg duration', value: formatDur(avgDuration) },
                { label: 'Analyzed',     value: `${analysisPct}%` },
                { label: 'Cost',         value: `$${totalCost.toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} data-mini className="bg-surface px-4 py-3.5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3">{label}</div>
                  <div className="mt-1 text-[17px] font-semibold nums text-ink">{value}</div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6 pb-16 pt-10">

          {/* ── PIPELINE STRIP ─────────────────────────────────────────────── */}
          <PipelineStrip stats={pipelineStats as Parameters<typeof PipelineStrip>[0]['stats']} />

          {/* ── ALERTS ─────────────────────────────────────────────────────── */}
          {activeAlerts.length > 0 && (
            <Reveal className="mb-10">
              <div className="relative overflow-hidden rounded-2xl border border-crit-border bg-surface card-inset">
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--color-crit), transparent)' }}
                />
                <div className="px-5 py-3.5 flex items-center gap-3 border-b border-crit-border/40">
                  <span className="dot-live" style={{ background: 'var(--color-crit)' }} />
                  <span className="text-[13px] font-semibold text-ink">Live alerts</span>
                  <span className="text-[11px] text-ink-3 nums">{activeAlerts.length} rule{activeAlerts.length > 1 ? 's' : ''} firing</span>
                </div>
                <div className="divide-y divide-border-subtle">
                  {activeAlerts.map((alert, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-4">
                      <span className={alert.severity === 'critical' ? 'dot-crit h-2 w-2 rounded-full shrink-0' : 'dot-warn h-2 w-2 rounded-full shrink-0'} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">{alert.label}</div>
                        <div className="text-[11px] text-ink-3 nums mt-0.5">
                          {display(alert.agent)} · {alert.count} call{alert.count > 1 ? 's' : ''} ·{' '}
                          <Link href={`/calls/${alert.example_call_id}`} className="hover:text-accent transition-colors font-mono">
                            {alert.example_call_id.substring(0, 10)}…
                          </Link>
                        </div>
                      </div>
                      <AckAlertButton ruleId={alert.rule_id} agent={alert.agent} />
                      <span className="text-[11px] text-ink-3 nums shrink-0">{new Date(alert.fired_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {/* ── AGENT GRID ──────────────────────────────────────────────────── */}
          <section className="mb-12">
            <header className="flex items-end justify-between gap-6 mb-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent mb-2">Agents</div>
                <h2 className="text-[24px] font-bold tracking-tight">
                  Ranked by call volume
                  <span className="ml-3 text-[13px] font-normal text-ink-3">Click for errors, patches, fixes</span>
                </h2>
              </div>
              <div className="hidden md:flex items-center gap-4 text-[11px] text-ink-3 uppercase tracking-wider">
                <LegendDot tone="accent" label="Healthy" />
                <LegendDot tone="warn" label="Watch" />
                <LegendDot tone="crit" label="Critical" />
              </div>
            </header>

            {agentSummaries.length === 0 ? (
              <div className="panel px-6 py-14 text-center">
                <div className="text-2xl mb-2 text-ink-3">—</div>
                <div className="text-sm font-medium text-ink-2">No agents found</div>
                <div className="text-xs text-ink-3 mt-1">Run sync to populate call data.</div>
              </div>
            ) : (
              <Reveal selector="[data-agent]" stagger={0.05} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {agentSummaries.map((agent, idx) => {
                  const aid = agentIdMap.get(agent.client_name);
                  const href = aid ? `/dashboard/${aid}` : '#';
                  const isFeatured = idx === 0;
                  const tone = agent.critical_count > 0
                    ? 'crit'
                    : agent.error_rate > 50
                      ? 'warn'
                      : agent.error_rate > 0
                        ? 'accent'
                        : 'ok';
                  const sparkData = sparkFor(agent.client_name);
                  return (
                    <Link
                      key={agent.client_name}
                      href={href}
                      data-agent
                      className={`group relative overflow-hidden rounded-2xl border border-border bg-surface card-inset transition-all duration-300 hover:border-border-strong hover:-translate-y-0.5 ${isFeatured ? 'md:col-span-2 xl:col-span-2' : ''}`}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-px opacity-60 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: `linear-gradient(90deg, transparent, var(--color-${tone === 'ok' ? 'ok' : tone}), transparent)`,
                        }}
                      />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-ink leading-tight truncate">
                              {display(agent.client_name)}
                            </h3>
                            <div className="text-[11px] text-ink-3 mt-0.5 font-mono truncate">
                              {agent.top_error_type
                                ? <>top · <span className="text-ink-2">{agent.top_error_type.replace(/_/g, ' ')}</span></>
                                : 'no active errors'}
                            </div>
                          </div>
                          <Pill tone={tone} count={agent.critical_count} errorRate={agent.error_rate} />
                        </div>

                        <div className={`grid ${isFeatured ? 'grid-cols-4' : 'grid-cols-3'} gap-4 items-end`}>
                          <Metric label="Calls" value={agent.total_calls.toString()} large />
                          <Metric
                            label="Error rate"
                            value={`${agent.error_rate}%`}
                            tone={agent.error_rate > 50 ? 'crit' : agent.error_rate > 30 ? 'warn' : 'default'}
                            large
                          />
                          <Metric
                            label="Errors"
                            value={agent.calls_with_errors.toString()}
                            tone={agent.calls_with_errors > 0 ? 'warn' : 'ok'}
                            large
                          />
                          {isFeatured && (
                            <div className="hidden md:block">
                              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 mb-1">Last 8wk</div>
                              <Sparkline data={sparkData} width={140} height={36} />
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between text-[11px] text-ink-3 nums">
                          <span>{agent.analyzed_calls} / {agent.total_calls} analyzed</span>
                          <span className="text-accent opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                            View errors →
                          </span>
                        </div>
                      </div>

                      {!isFeatured && sparkData.length > 1 && (
                        <div className="absolute right-3 top-3 opacity-30 group-hover:opacity-80 transition-opacity">
                          <Sparkline data={sparkData} width={64} height={20} glow={false} />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </Reveal>
            )}
          </section>

          {/* ── TREND CHART ─────────────────────────────────────────────────── */}
          {trendData.length > 0 && (
            <section className="mb-12">
              <header className="flex items-end justify-between mb-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent mb-1.5">Error rate trend</div>
                  <h2 className="text-[20px] font-bold tracking-tight">Weekly per agent</h2>
                </div>
                <span className="text-[11px] text-ink-3 nums uppercase tracking-wider">Last 12 weeks</span>
              </header>
              <div className="panel card-inset p-5">
                <TrendChart data={trendData} agents={trendAgents} />
              </div>
            </section>
          )}

          {/* ── CALL LOG ───────────────────────────────────────────────────── */}
          <section>
            <header className="flex items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent mb-1.5">Call log</div>
                <h2 className="text-[20px] font-bold tracking-tight">
                  {clientFilter ? display(clientFilter) : 'All'} calls
                  <span className="ml-3 text-[12px] font-normal nums text-ink-3">{filteredTotal?.toLocaleString()}</span>
                </h2>
              </div>
              <div className="flex flex-wrap gap-1 justify-end max-w-2xl">
                <FilterChip active={!clientFilter} href={buildUrl({ client: '', page: '1' })}>
                  All · {totalCalls}
                </FilterChip>
                {clients.slice(0, 6).map(([name, count]) => (
                  <FilterChip key={name} active={clientFilter === name} href={buildUrl({ client: name, page: '1' })}>
                    {display(name)} · {count}
                  </FilterChip>
                ))}
              </div>
            </header>

            <div className="panel card-inset overflow-hidden">
              <div className="grid grid-cols-[1fr_88px_84px_84px_72px] px-5 py-2.5 border-b border-border-subtle bg-surface-2/50">
                {['Agent / ID', 'Status', 'Duration', 'Errors', 'Date'].map((h) => (
                  <span key={h} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-border-subtle">
                {calls?.length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <div className="text-sm text-ink-2 font-medium mb-1">No calls yet</div>
                    <div className="text-xs text-ink-3">
                      Run <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded">npm run sync</code> to fetch from Ultravox.
                    </div>
                  </div>
                )}
                {calls?.map((call) => {
                  const isUnjoined = call.ended_reason === 'unjoined';
                  const isError = call.ended_reason?.includes('error');
                  const dur = call.duration_seconds || 0;
                  const hasErrors = (call.error_count ?? 0) > 0;
                  const hasCritical = (call.critical_error_count ?? 0) > 0;
                  const noTranscript = isUnjoined || dur < 5;

                  const statusTone = isUnjoined
                    ? 'ink-3'
                    : isError
                      ? 'crit'
                      : call.status === 'active'
                        ? 'accent'
                        : 'ok';

                  return (
                    <Link
                      key={call.call_id}
                      href={`/calls/${call.call_id}`}
                      className="grid grid-cols-[1fr_88px_84px_84px_72px] px-5 py-3 items-center gap-4 transition-colors hover:bg-surface-2/60"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: `var(--color-${statusTone === 'ink-3' ? 'ink-3' : statusTone})` }}
                        />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-ink truncate">{display(call.client_name)}</div>
                          <div className="text-[10px] font-mono text-ink-3 truncate">{call.call_id}</div>
                        </div>
                      </div>

                      <div className="text-[11px] font-medium uppercase tracking-wider">
                        <span style={{ color: `var(--color-${statusTone === 'ink-3' ? 'ink-3' : statusTone})` }}>
                          {call.status}
                        </span>
                      </div>

                      <div className="text-[12px] text-ink-2 nums font-mono">
                        {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, '0')}
                      </div>

                      <div className="text-[12px] nums">
                        {hasCritical ? (
                          <span className="font-semibold text-crit">{call.critical_error_count}c / {call.error_count}</span>
                        ) : hasErrors ? (
                          <span className="font-medium text-warn">{call.error_count}</span>
                        ) : noTranscript && call.analysis_status === 'pending' ? (
                          <span className="text-ink-3">—</span>
                        ) : call.analysis_status === 'complete' ? (
                          <span className="text-ok">✓</span>
                        ) : (
                          <span className="text-ink-3 text-[11px]">{call.analysis_status ?? '—'}</span>
                        )}
                      </div>

                      <div className="text-[11px] text-ink-3 nums">
                        {new Date(call.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between">
                  <span className="text-[11px] text-ink-3 nums">Page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 text-[12px] border border-border rounded-md text-ink-2 hover:border-border-strong hover:text-ink transition-colors">
                        ← Prev
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 text-[12px] border border-border rounded-md text-ink-2 hover:border-border-strong hover:text-ink transition-colors">
                        Next →
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

// ── Local presentational primitives ──────────────────────────────────────────

function KpiPrimary({
  label, value, suffix, tone, accent, support, emphasis, live,
}: {
  label: string;
  value: number;
  suffix?: string;
  tone: string;
  accent: string;
  support: string;
  emphasis?: boolean;
  live?: boolean;
}) {
  return (
    <div
      data-kpi
      className="relative overflow-hidden rounded-2xl border border-border bg-surface card-inset p-5"
    >
      <span
        aria-hidden
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-50 blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">{label}</span>
        {live && <span className="dot-live" />}
      </div>
      <div className={`relative font-black tracking-[-0.04em] nums leading-none ${emphasis ? 'text-[72px]' : 'text-[56px]'} ${tone}`}>
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="relative mt-3 text-[12px] text-ink-3">{support}</div>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: 'accent' | 'warn' | 'crit'; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(--color-${tone})` }} />
      {label}
    </span>
  );
}

function Pill({ tone, count, errorRate }: { tone: 'crit' | 'warn' | 'accent' | 'ok'; count: number; errorRate: number }) {
  if (count > 0) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-crit-border bg-crit-bg/60 px-2 py-0.5 text-[11px] font-semibold text-crit nums">
        <span className="dot-live" style={{ background: 'var(--color-crit)' }} />
        {count} critical
      </span>
    );
  }
  if (tone === 'ok') {
    return (
      <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2/60 px-2 py-0.5 text-[11px] font-medium text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        healthy
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[11px] font-medium text-ink-3 nums">
      {errorRate}% err
    </span>
  );
}

function Metric({ label, value, tone = 'default', large }: { label: string; value: string; tone?: 'default' | 'crit' | 'warn' | 'ok'; large?: boolean }) {
  const colorClass = tone === 'crit' ? 'text-crit' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 mb-1">{label}</div>
      <div className={`${large ? 'text-[22px]' : 'text-[16px]'} font-bold nums leading-none ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}

function FilterChip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
        active
          ? 'bg-accent text-canvas border-accent'
          : 'border-border-subtle text-ink-2 hover:border-border-strong hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}
