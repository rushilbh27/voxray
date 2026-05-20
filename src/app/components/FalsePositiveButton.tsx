'use client';
import { useState } from 'react';

interface Props {
  callId: string;
  errorType: string;
  isFP?: boolean;
}

export function FalsePositiveButton({ callId, errorType, isFP: initial = false }: Props) {
  const [isFP, setIsFP] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/calls/${callId}/false-positive`, {
      method: isFP ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_type: errorType }),
    });
    setIsFP(!isFP);
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isFP ? 'Marked as false positive — click to unmark' : 'Mark as false positive'}
      className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
        isFP
          ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
          : 'text-gray-300 hover:text-orange-400 hover:bg-orange-50'
      }`}
    >
      {isFP ? 'FP ✓' : 'FP?'}
    </button>
  );
}
