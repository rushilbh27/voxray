'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export interface TrendPoint {
  week: string;
  label: string;
  [agent: string]: string | number;
}

const AGENT_COLORS: Record<string, string> = {
  'Sales AI':                    'oklch(74% 0.175 55)',   // amber accent
  'Debt Collector':              'oklch(68% 0.215 25)',   // crit red
  'Cold Outreach':               'oklch(80% 0.155 75)',   // warn yellow
  'NECTOR Demo':                 'oklch(68% 0.180 295)',  // violet
  'Edifice_Properties_inbound':  'oklch(72% 0.130 152)',  // ok green
  'Davansh_Investment_inbound':  'oklch(72% 0.130 220)',  // cool blue
  'Shell Gas Uganda':            'oklch(72% 0.180 110)',  // lime
};

interface Props {
  data: TrendPoint[];
  agents: string[];
}

const displayName = (raw: string) => raw.replace(/[_-]+/g, ' ').replace(/inbound$/i, '').trim();

export function TrendChart({ data, agents }: Props) {
  if (!data.length) return (
    <div className="text-sm text-ink-3 text-center py-10 italic">
      Not enough analyzed data for trend chart yet.
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
          axisLine={{ stroke: 'var(--color-border)' }}
          tickLine={false}
        />
        <YAxis
          unit="%"
          tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(v, name) => [`${v}%`, displayName(String(name))]}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--color-ink)',
            boxShadow: '0 8px 24px color-mix(in oklch, black 30%, transparent)',
          }}
          labelStyle={{ color: 'var(--color-ink-2)', fontSize: 11, marginBottom: 4 }}
          cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={7}
          formatter={(v) => <span style={{ color: 'var(--color-ink-2)' }}>{displayName(v)}</span>}
        />
        {agents.map((agent) => (
          <Line
            key={agent}
            type="monotone"
            dataKey={agent}
            stroke={AGENT_COLORS[agent] ?? 'oklch(60% 0.020 60)'}
            dot={false}
            strokeWidth={1.75}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
