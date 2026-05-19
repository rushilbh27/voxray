'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export interface TrendPoint {
  week: string;   // "2026-W18"
  label: string;  // "May 4"
  [agent: string]: string | number;
}

const AGENT_COLORS: Record<string, string> = {
  'Sales AI':                    '#3b82f6',
  'Debt Collector':              '#ef4444',
  'Cold Outreach':               '#f59e0b',
  'NECTOR Demo':                 '#8b5cf6',
  'Edifice_Properties_inbound':  '#10b981',
  'Davansh_Investment_inbound':  '#06b6d4',
};

interface Props {
  data: TrendPoint[];
  agents: string[];
}

export function TrendChart({ data, agents }: Props) {
  if (!data.length) return (
    <div className="text-sm text-gray-400 text-center py-8">
      Not enough analyzed data for trend chart yet.
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip formatter={(v) => [`${v}%`, '']} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {agents.map((agent) => (
          <Line
            key={agent}
            type="monotone"
            dataKey={agent}
            stroke={AGENT_COLORS[agent] ?? '#94a3b8'}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
