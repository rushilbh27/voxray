'use client';

/**
 * ErrorHeatmap — 30-day calendar heatmap per error type.
 * Server-side data building is in src/lib/heatmap-utils.ts (server-safe).
 */

import type { HeatmapRow } from '@/lib/heatmap-utils';

interface Props {
  rows: HeatmapRow[];
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
}

export function ErrorHeatmap({ rows }: Props) {
  if (rows.length === 0) return null;

  const maxCount = Math.max(...rows.flatMap((r) => r.days.map((d) => d.count)), 1);

  function cellColor(count: number): string {
    if (count === 0) return 'bg-surface-2';
    const intensity = count / maxCount;
    if (intensity < 0.33) return 'bg-warn/30';
    if (intensity < 0.66) return 'bg-warn/60';
    return 'bg-warn';
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr>
            <th className="text-left text-ink-3 font-medium pr-3 pb-1 w-40">Error type</th>
            {rows[0].days.map((d, i) => (
              <th
                key={i}
                className="text-center text-ink-3 font-normal pb-1 min-w-[20px]"
                title={formatDay(d.date)}
              >
                {i % 5 === 0 ? getDayLabel(d.date) : ''}
              </th>
            ))}
            <th className="text-right text-ink-3 font-medium pl-2 pb-1">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = row.days.reduce((s, d) => s + d.count, 0);
            return (
              <tr key={row.errorType} className="group">
                <td className="pr-3 py-0.5 text-ink-2 font-medium truncate max-w-[160px] group-hover:text-ink transition-colors">
                  {row.label}
                </td>
                {row.days.map((d, i) => (
                  <td key={i} className="py-0.5 px-px">
                    <div
                      className={`h-4 w-4 rounded-sm ${cellColor(d.count)} transition-opacity`}
                      title={d.count > 0 ? `${formatDay(d.date)}: ${d.count} call${d.count > 1 ? 's' : ''}` : formatDay(d.date)}
                    />
                  </td>
                ))}
                <td className="pl-2 py-0.5 text-right font-bold text-warn tabular-nums">
                  {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-ink-3">
        <span>Less</span>
        <div className="h-3 w-3 rounded-sm bg-surface-2 border border-border-subtle" />
        <div className="h-3 w-3 rounded-sm bg-warn/30" />
        <div className="h-3 w-3 rounded-sm bg-warn/60" />
        <div className="h-3 w-3 rounded-sm bg-warn" />
        <span>More</span>
      </div>
    </div>
  );
}
