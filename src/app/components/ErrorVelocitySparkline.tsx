'use client';

export interface VelocityPoint {
  week:  string;
  count: number;
}

interface Props {
  data: VelocityPoint[];
}

/**
 * Tiny SVG sparkline showing per-error-type weekly count trend.
 * Green = improving (count falling), red = worsening, gray = flat.
 */
export function ErrorVelocitySparkline({ data }: Props) {
  if (data.length < 2) return null;

  // Last 8 weeks only
  const points = data.slice(-8);
  const counts  = points.map(p => p.count);
  const max     = Math.max(...counts, 1);

  // Trend: compare last 4 vs previous 4
  const mid   = Math.floor(points.length / 2);
  const prev  = points.slice(0, mid).reduce((s, p) => s + p.count, 0);
  const recent = points.slice(mid).reduce((s, p) => s + p.count, 0);
  const trend  = recent < prev ? 'down' : recent > prev ? 'up' : 'flat';

  const W = 56, H = 20, pad = 2;
  const xStep  = (W - pad * 2) / Math.max(points.length - 1, 1);
  const yScale = (H - pad * 2) / max;

  const pts = points.map((p, i) => ({
    x: pad + i * xStep,
    y: H - pad - p.count * yScale,
  }));

  const pathD = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const color =
    trend === 'down' ? 'var(--color-ok)'   :
    trend === 'up'   ? 'var(--color-crit)' :
    'var(--color-ink-3)';

  const arrow = trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→';
  const arrowColor =
    trend === 'down' ? 'text-ok' :
    trend === 'up'   ? 'text-crit' :
    'text-ink-3';

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${points.length}-week trend · ${counts.join(', ')}`}
    >
      <svg width={W} height={H} className="overflow-visible">
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
        ))}
      </svg>
      <span className={`text-[10px] font-bold tabular-nums ${arrowColor}`}>{arrow}</span>
    </span>
  );
}
