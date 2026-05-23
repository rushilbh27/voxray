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
      <div className="mb-10 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface/40 px-4 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">AI pipeline</span>
        <span className="text-xs text-ink-3">No traces yet — data appears after first analysis</span>
      </div>
    );
  }

  const fmt = (ms: number | null) =>
    ms == null ? '—' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;

  const items = [
    { label: 'p50',           value: fmt(stats.p50_latency_ms),  hi: (stats.p50_latency_ms ?? 0) > 3000 },
    { label: 'p95',           value: fmt(stats.p95_latency_ms),  hi: (stats.p95_latency_ms ?? 0) > 8000 },
    { label: 'Cost today',    value: stats.cost_today != null ? `$${stats.cost_today.toFixed(4)}` : '—', hi: false },
    { label: 'Success 7d',    value: stats.success_rate_7d != null ? `${Math.round(stats.success_rate_7d * 100)}%` : '—', hi: (stats.success_rate_7d ?? 1) < 0.95 },
    { label: 'Analyses 24h',  value: String(stats.traces_today ?? 0), hi: false },
  ];

  return (
    <div className="mb-10 rounded-xl border border-border-subtle bg-surface/40 overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-2.5">
        <span className="dot-live" style={{ background: 'var(--color-ok)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">AI pipeline</span>
        <span className="text-[10px] text-ink-3 ml-1">Haiku 4.5 · last 24h</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5">
        {items.map(({ label, value, hi }, idx) => (
          <div
            key={label}
            className={`px-4 py-3 ${idx > 0 ? 'border-l border-border-subtle' : ''}`}
          >
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 mb-0.5">{label}</div>
            <div className={`text-[18px] font-bold nums ${hi ? 'text-warn' : 'text-ink'}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
