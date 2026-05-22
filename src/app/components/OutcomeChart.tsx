'use client';

/**
 * OutcomeChart — weekly stacked bar chart showing goal_outcome breakdown.
 * Server-side data building is in src/lib/outcome-utils.ts (server-safe).
 */

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import type { OutcomePoint } from '@/lib/outcome-utils';

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
