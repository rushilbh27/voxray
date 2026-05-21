'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface VersionPoint {
  prompt_hash: string;
  first_used:  string;
  total:       number;
  with_errors: number;
}

interface Props {
  data:  VersionPoint[];
  agent: string;
}

export function PromptVersionChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="px-5 py-6 text-center text-xs text-ink-3">
        Need ≥2 prompt versions to compare. Apply a prompt fix in Ultravox, then re-analyze calls.
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    name:      `v${i + 1} · ${d.prompt_hash.slice(0, 6)}`,
    errorRate: d.total > 0 ? Math.round((d.with_errors / d.total) * 100) : 0,
    total:     d.total,
    firstUsed: new Date(d.first_used).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const first  = chartData[0].errorRate;
  const latest = chartData[chartData.length - 1].errorRate;
  const delta  = latest - first;

  return (
    <div>
      {delta !== 0 && (
        <div className={`text-xs font-medium mb-3 ${delta < 0 ? 'text-ok' : 'text-crit'}`}>
          {delta < 0 ? '▼' : '▲'} {Math.abs(delta)}pp since first prompt — {delta < 0 ? 'improving' : 'worsening'}
        </div>
      )}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barSize={28}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
            width={36}
          />
          <Tooltip
            formatter={(v, _, entry) =>
              [`${v}% error rate · ${(entry as { payload: { total: number } }).payload.total} calls`,
               (entry as { payload: { firstUsed: string } }).payload.firstUsed]
            }
            contentStyle={{
              background:   'var(--color-surface)',
              border:       '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize:     12,
            }}
          />
          <Bar dataKey="errorRate" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={
                  i === chartData.length - 1
                    ? 'var(--color-accent)'
                    : entry.errorRate > first
                      ? 'var(--color-crit)'
                      : 'var(--color-ok)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
