/**
 * CostBreakdown — per-agent cost summary for the main dashboard.
 * Server component — no Recharts, pure CSS bars.
 * Covers: today / this week / all-time totals + per-agent type breakdown.
 */

export interface AgentCostRow {
  agentType: string;
  total: number;
  count: number;
}

interface Props {
  today: number;
  week: number;
  allTime: number;
  byAgent: AgentCostRow[];
}

const AGENT_LABELS: Record<string, string> = {
  sales:        'Sales AI',
  debt:         'Debt Collector',
  cold_outreach:'Cold Outreach',
  unknown:      'Other',
};

// OKLCH literals — no CSS vars (not rendered server-side in SVG, but consistent with palette)
const AGENT_COLORS: Record<string, string> = {
  sales:         'oklch(78% 0.17 55)',   // amber accent
  debt:          'oklch(80% 0.155 75)',  // warn orange
  cold_outreach: 'oklch(72% 0.130 152)', // ok green
  unknown:       'oklch(48% 0.010 55)',  // muted
};

function fmt(n: number): string {
  if (n < 0.01) return `$${(n * 100).toFixed(3)}¢`;
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

export function CostBreakdown({ today, week, allTime, byAgent }: Props) {
  if (allTime === 0 && byAgent.length === 0) {
    return (
      <div className="mb-10 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface/40 px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">Cost & Usage</span>
        <span className="text-xs text-ink-3">No cost data yet — appears after first analysis</span>
      </div>
    );
  }

  const maxCost = Math.max(...byAgent.map((a) => a.total), 0.0001);
  const totalAnalyses = byAgent.reduce((s, a) => s + a.count, 0);
  const avgCostPerAnalysis = totalAnalyses > 0 ? allTime / totalAnalyses : 0;

  return (
    <div className="mb-10 rounded-xl border border-border-subtle bg-surface/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 border-b border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">Cost &amp; Usage</span>
          <span className="text-[10px] text-ink-3 ml-1">Haiku 4.5 · error analysis only</span>
        </div>
        <span className="text-[10px] text-ink-3 nums">
          avg {fmt(avgCostPerAnalysis)}/call · {totalAnalyses.toLocaleString()} total analyses
        </span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
        {[
          { label: 'Today',     value: fmt(today) },
          { label: 'This week', value: fmt(week) },
          { label: 'All time',  value: fmt(allTime) },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 mb-0.5">{label}</div>
            <div className="text-[18px] font-bold nums text-ink">{value}</div>
          </div>
        ))}
      </div>

      {/* Per-agent bars */}
      {byAgent.length > 0 && (
        <div className="px-4 py-3 space-y-2.5">
          {byAgent
            .sort((a, b) => b.total - a.total)
            .map((agent) => {
              const pct = Math.max(2, (agent.total / maxCost) * 100);
              const color = AGENT_COLORS[agent.agentType] ?? AGENT_COLORS.unknown;
              const label = AGENT_LABELS[agent.agentType] ?? agent.agentType;
              return (
                <div key={agent.agentType}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-ink-2 font-medium">{label}</span>
                    <span className="nums text-ink-3">
                      {fmt(agent.total)}
                      <span className="ml-2 text-ink-3/60">{agent.count} calls</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
