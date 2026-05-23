'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  callId: string;
  status: string | null;
}

export default function AnalyzeButton({ callId, status }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function run(force = false) {
    setLoading(true);
    try {
      await fetch(`/api/calls/${callId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (loading || status === 'analyzing') {
    return (
      <span className="text-xs text-accent animate-pulse">Analyzing…</span>
    );
  }

  if (status === 'complete') {
    return (
      <button
        onClick={() => run(true)}
        className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
      >
        Re-analyze
      </button>
    );
  }

  return (
    <button
      onClick={() => run(false)}
      className="px-3 py-1.5 text-xs font-medium bg-accent text-canvas rounded-md hover:bg-accent-hover transition-colors"
    >
      Analyze
    </button>
  );
}
