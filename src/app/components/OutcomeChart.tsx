'use client';

/**
 * OutcomeChart — weekly stacked bar chart showing goal_outcome breakdown.
 * Server-side data building is in src/lib/outcome-utils.ts (server-safe).
 */

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import type { OutcomePoint } from '@/lib/outcome-utils';

// OKLCH literals — cannot use CSS vars in SVG fill attributes.
// Matched to the design token palette (ok / warn / crit + neutrals).
const OUTCOME_COLORS: Record<string, string> = {
  success:        'oklch(72% 0.130 152)',  // --color-ok
  no_answer:      'oklch(48% 0.010 55)',   // muted warm neutral
  not_interested: 'oklch(80% 0.155 75)',   // --color-warn
  incomplete:     'oklch(74% 0.170 42)',   // orange
  no_save:        'oklch(70% 0.215 25)',   // --color-crit
  other:          'oklch(62% 0.012 55)',   // dimmed neutral
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
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--color-ink-3)' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--color-ink)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--color-ink-2)' }}
          cursor={{ fill: 'color-mix(in oklch, var(--color-ink-3) 8%, transparent)' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          formatter={(v) => (
            <span style={{ color: 'var(--color-ink-3)' }}>{OUTCOME_LABELS[v] ?? v}</span>
          )}
        />
        {keys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="outcomes"
            fill={OUTCOME_COLORS[key]}
            radius={key === 'other' ? [2, 2, 0, 0] : [0, 0, 0, 0]}
          >
            {data.map((_, i) => <Cell key={i} fill={OUTCOME_COLORS[key]} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
