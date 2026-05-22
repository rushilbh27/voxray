'use client';

/**
 * OutcomeChart — weekly stacked bar chart showing goal_outcome breakdown.
 * Tracks success rate over time — drops here signal problems before error count spikes.
 */

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

export interface OutcomePoint {
  week: string;        // "MMM d"
  success: number;
  no_answer: number;
  not_interested: number;
  incomplete: number;
  no_save: number;
  other: number;
}

const OUTCOME_COLORS: Record<string, string> = {
  success:        '#22c55e',
  no_answer:      '#6b7280',
  not_interested: '#eab308',
  incomplete:     '#f97316',
  no_save:        '#ef4444',
  other:          '#94a3b8',
};

const OUTCOME_LABELS: Record<string, string> = {
  success:        'Success',
  no_answer:      'No answer',
  not_interested: 'Not interested',
  incomplete:     'Incomplete',
  no_save:        'No save',
  other:          'Other',
};

interface Props {
  data: OutcomePoint[];
}

export function OutcomeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-ink-3">
        No outcome data yet
      </div>
    );
  }

  const keys = Object.keys(OUTCOME_COLORS) as Array<keyof typeof OUTCOME_COLORS>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} formatter={(v) => OUTCOME_LABELS[v] ?? v} />
        {keys.map((key) => (
          <Bar key={key} dataKey={key} stackId="outcomes" fill={OUTCOME_COLORS[key]} radius={key === 'other' ? [2, 2, 0, 0] : [0, 0, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={OUTCOME_COLORS[key]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Server-side helper to build OutcomePoint[] from raw call data ─────────────

export interface RawCallForOutcome {
  created_at: string;
  call_errors: unknown;
}

const KNOWN_OUTCOMES = new Set(['success', 'no_answer', 'not_interested', 'incomplete', 'no_save']);

export function buildOutcomeData(calls: RawCallForOutcome[], weeks = 12): OutcomePoint[] {
  // Build week buckets (ISO week start = Monday)
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStarts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now - i * weekMs);
    // Round to Monday
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    weekStarts.push(d);
  }

  const buckets = new Map<number, OutcomePoint>();
  for (const ws of weekStarts) {
    const label = ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    buckets.set(ws.getTime(), {
      week: label,
      success: 0,
      no_answer: 0,
      not_interested: 0,
      incomplete: 0,
      no_save: 0,
      other: 0,
    });
  }

  for (const call of calls) {
    const callDate = new Date(call.created_at);
    const outcome = (call.call_errors as { goal_outcome?: string } | null)?.goal_outcome ?? 'other';
    const normalizedOutcome = KNOWN_OUTCOMES.has(outcome) ? outcome : 'other';

    // Find which week bucket this call belongs to
    let targetWeek: number | null = null;
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      if (callDate >= weekStarts[i]) {
        targetWeek = weekStarts[i].getTime();
        break;
      }
    }
    if (targetWeek === null) continue;

    const bucket = buckets.get(targetWeek);
    if (!bucket) continue;
    (bucket as unknown as Record<string, number>)[normalizedOutcome]++;
  }

  return [...buckets.values()].filter((b) =>
    b.success + b.no_answer + b.not_interested + b.incomplete + b.no_save + b.other > 0
  );
}
