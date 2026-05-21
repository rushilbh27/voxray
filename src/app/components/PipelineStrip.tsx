'use client';

interface PipelineStats {
  p50_latency_ms:  number | null;
  p95_latency_ms:  number | null;
  cost_today:      number | null;
  success_rate_7d: number | null;
  traces_today:    number | null;
}

export function PipelineStrip({ stats }: { stats: PipelineStats | null }) {
  if (!stats || (stats.traces_today ?? 0) === 0) {
    return (
      <div className="py-4 border-b border-border mb-8 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">AI Pipeline</span>
        <span className="text-xs text-ink-3 ml-2">No traces yet — data appears after first analysis</span>
      </div>
    );
  }

  const fmt = (ms: number | null) =>
    ms == null ? '—' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

  const items = [
    { label: 'p50 Latency',  value: fmt(stats.p50_latency_ms),  hi: (stats.p50_latency_ms ?? 0) > 3000 },
    { label: 'p95 Latency',  value: fmt(stats.p95_latency_ms),  hi: (stats.p95_latency_ms ?? 0) > 8000 },
    { label: 'Cost Today',   value: stats.cost_today != null ? `$${stats.cost_today.toFixed(4)}` : '—', hi: false },
    { label: 'Success Rate', value: stats.success_rate_7d != null ? `${Math.round(stats.success_rate_7d * 100)}%` : '—', hi: (stats.success_rate_7d ?? 1) < 0.95 },
    { label: 'Analyses/Day', value: String(stats.traces_today ?? 0), hi: false },
  ];

  return (
    <div className="py-4 border-b border-border mb-8">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-3">AI Pipeline · Haiku 4.5 · Last 24h</div>
      <div className="grid grid-cols-5 gap-6">
        {items.map(({ label, value, hi }) => (
          <div key={label}>
            <div className="text-[11px] font-medium text-ink-3 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-lg font-bold tabular-nums ${hi ? 'text-warn' : 'text-ink'}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
