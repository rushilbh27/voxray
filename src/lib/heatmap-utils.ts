/**
 * Server-side utility for building ErrorHeatmap data.
 * No 'use client' — safe to import in server components.
 */

export interface RawCallForHeatmap {
  created_at: string;
  call_errors: unknown;
}

export interface DayBucket {
  date: string;
  count: number;
}

export interface HeatmapRow {
  errorType: string;
  label: string;
  days: DayBucket[];
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
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const errorDayCounts = new Map<string, number[]>();

  for (const call of calls) {
    const dateStr = call.created_at.slice(0, 10);
    const idx = dayIndex.get(dateStr);
    if (idx === undefined) continue;
    const errors = (call.call_errors as { errors?: Array<{ type: string }> } | null)?.errors ?? [];
    const seenInCall = new Set<string>();
    for (const e of errors) {
      if (!seenInCall.has(e.type)) {
        seenInCall.add(e.type);
        if (!errorDayCounts.has(e.type)) errorDayCounts.set(e.type, new Array(30).fill(0));
        errorDayCounts.get(e.type)![idx]++;
      }
    }
  }

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
