'use client';
import { useState } from 'react';

interface Props {
  ruleId: string;
  agent: string;
  onAcked?: () => void;
}

export function AckAlertButton({ ruleId, agent, onAcked }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function ack(hours: number) {
    setLoading(true);
    await fetch('/api/alerts/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_id: ruleId, agent, hours }),
    });
    setLoading(false);
    setDone(true);
    onAcked?.();
  }

  if (done) return <span className="text-xs text-gray-400">Acknowledged</span>;

  return (
    <div className="flex gap-1">
      {[4, 24].map((h) => (
        <button
          key={h}
          disabled={loading}
          onClick={() => ack(h)}
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors"
        >
          Ack {h}h
        </button>
      ))}
    </div>
  );
}
