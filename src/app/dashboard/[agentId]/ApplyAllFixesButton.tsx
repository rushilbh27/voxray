'use client';

import { useState } from 'react';

interface Props {
  agentId: string;
  agentName: string;
  errorTypes: string[];
}

type State = 'idle' | 'confirming' | 'applying' | 'done' | 'all_applied' | 'error';

export function ApplyAllFixesButton({ agentId, agentName, errorTypes }: Props) {
  const [state, setState] = useState<State>('idle');
  const [results, setResults] = useState<{ applied: string[]; alreadyApplied: string[]; failed: string[] }>({
    applied: [],
    alreadyApplied: [],
    failed: [],
  });


  if (errorTypes.length === 0) return null;

  async function applyAll() {
    setState('applying');
    const applied: string[] = [];
    const alreadyApplied: string[] = [];
    const failed: string[] = [];

    for (const errorType of errorTypes) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`/api/agents/${agentId}/apply-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorType, description: `Batch apply: ${errorType}` }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          applied.push(errorType);
        } else if (res.status === 409) {
          // 409 = patch find-text not in prompt = already applied
          alreadyApplied.push(errorType);
        } else {
          failed.push(errorType);
        }
      } catch {
        failed.push(errorType);
      }
    }

    setResults({ applied, alreadyApplied, failed });

    // Determine final state
    if (failed.length > 0 && applied.length === 0 && alreadyApplied.length === 0) {
      setState('error');
    } else if (applied.length === 0 && alreadyApplied.length > 0 && failed.length === 0) {
      setState('all_applied');
    } else {
      setState('done');
    }
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-ok font-medium">
        ✓ {results.applied.length} patch{results.applied.length !== 1 ? 'es' : ''} applied
        {results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}
      </span>
    );
  }

  if (state === 'all_applied') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ok font-medium">
        ✓ All patches already applied to {agentName}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="text-xs text-crit font-medium">
        ✗ All patches failed
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="text-xs text-ink">
          Patch <span className="font-semibold text-warn">{errorTypes.length} error type{errorTypes.length !== 1 ? 's' : ''}</span> on <span className="font-semibold">{agentName}</span>?
        </span>
        <button
          onClick={applyAll}
          className="text-xs px-2.5 py-0.5 bg-crit hover:opacity-90 text-white rounded font-semibold transition-opacity"
        >
          Yes, patch all
        </button>
        <button
          onClick={() => setState('idle')}
          className="text-xs text-ink-3 hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setState('confirming')}
      disabled={state === 'applying'}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-accent text-white hover:opacity-90 rounded-md font-semibold transition-opacity disabled:opacity-50"
    >
      {state === 'applying' ? '⏳ Applying all…' : `⚡ Apply all ${errorTypes.length} fixes`}
    </button>
  );
}
