'use client';

/**
 * ErrorHeatmap — 30-day calendar heatmap per error type.
 * Shows which days each error fired, making patterns (day-of-week, post-patch spikes) visible.
 */

interface DayBucket {
  date: string; // YYYY-MM-DD
  count: number;
}

interface HeatmapRow {
  errorType: string;
  label: string;
  days: DayBucket[]; // 30 entries, one per day
}

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

// ── Server-side helper to build HeatmapRow[] from raw call data ──────────────

export interface RawCallForHeatmap {
  created_at: string;
  call_errors: unknown;
}

const HUMAN_LABELS: Record<string, string> = {
  accepted_unknown_location: 'Unknown location',
  accepted_garbled_audio:   'Garbled audio',
  no_save_answers:          'No save (answers)',
  no_save_debt:             'No save (debt)',
  stacked_questions:        'Stacked questions',
  accepted_past_date:       'Past date accepted',
  accepted_vague_date:      'Vague date accepted',
  broke_promise:            'Broke promise',
  wrong_opening:            'Wrong opening',
  wrong_info:               'Wrong info',
  no_consultation:          'No consultation',
  skipped_repeat_rule:      'Skipped repeat rule',
  restart_loop:             'Restart loop',
  no_name_collected:        'Name not collected',
  calculated_balance:       'Calculated balance',
  invented_amount:          'Invented amount',
  no_product_context:       'No product context',
  spoke_luganda:            'Spoke Luganda',
  wrong_person_handling:    'Wrong person handling',
  no_commitment:            'No commitment',
  pushed_back:              'Pushed back',
  wrong_call_type:          'Wrong call type',
};

export function buildHeatmapRows(calls: RawCallForHeatmap[], topN = 6): HeatmapRow[] {
  // Build 30-day date array (most recent last)
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  // Count occurrences per error_type per day
  const errorDayCounts = new Map<string, number[]>(); // error_type → 30 counts

  for (const call of calls) {
    const dateStr = call.created_at.slice(0, 10);
    const idx = dayIndex.get(dateStr);
    if (idx === undefined) continue;

    const errors = (call.call_errors as { errors?: Array<{ type: string }> } | null)?.errors ?? [];
    const seenInCall = new Set<string>();
    for (const e of errors) {
      if (!seenInCall.has(e.type)) {
        seenInCall.add(e.type);
        if (!errorDayCounts.has(e.type)) {
          errorDayCounts.set(e.type, new Array(30).fill(0));
        }
        errorDayCounts.get(e.type)![idx]++;
      }
    }
  }

  // Sort by total count desc, take topN
  const sorted = [...errorDayCounts.entries()]
    .map(([type, counts]) => ({ type, total: counts.reduce((a, b) => a + b, 0), counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  return sorted.map(({ type, counts }) => ({
    errorType: type,
    label: HUMAN_LABELS[type] ?? type,
    days: days.map((date, i) => ({ date, count: counts[i] })),
  }));
}
