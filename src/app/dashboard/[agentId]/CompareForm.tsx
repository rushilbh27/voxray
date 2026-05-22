'use client';

/**
 * CompareForm — date picker that navigates to ?compare=YYYY-MM-DD
 * Lets operators pick the date a fix was applied and see before/after error rates.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  agentId: string;
  currentCompare?: string; // current ?compare value
}

export function CompareForm({ agentId, currentCompare }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(currentCompare ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      router.push(`/dashboard/${agentId}`);
    } else {
      router.push(`/dashboard/${agentId}?compare=${date}`);
    }
  }

  function handleClear() {
    setDate('');
    router.push(`/dashboard/${agentId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label className="text-xs text-ink-3 font-medium">Compare from</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="text-xs border border-border rounded-md px-2 py-1 bg-surface text-ink focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="text-xs px-3 py-1 rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
      >
        Compare
      </button>
      {currentCompare && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-ink-3 hover:text-ink transition-colors"
        >
          Clear
        </button>
      )}
    </form>
  );
}
