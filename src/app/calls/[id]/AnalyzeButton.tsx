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
      <span className="text-xs text-blue-500 animate-pulse">Analyzing...</span>
    );
  }

  if (status === 'complete') {
    return (
      <button
        onClick={() => run(true)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Re-analyze
      </button>
    );
  }

  return (
    <button
      onClick={() => run(false)}
      className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors"
    >
      Analyze
    </button>
  );
}
