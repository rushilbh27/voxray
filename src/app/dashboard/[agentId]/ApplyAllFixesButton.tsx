'use client';

import { useState } from 'react';

const NECTOR_DEMO_ID = '428d7591-3ba5-4b60-8aa5-a92012d12451';

interface Props {
  agentId: string;
  agentName: string;
  errorTypes: string[];
}

type State = 'idle' | 'confirming' | 'applying' | 'done' | 'error';

export function ApplyAllFixesButton({ agentId, agentName, errorTypes }: Props) {
  const [state, setState] = useState<State>('idle');
  const [results, setResults] = useState<{ applied: string[]; failed: string[] }>({ applied: [], failed: [] });
  const [errMsg, setErrMsg] = useState('');

  if (agentId !== NECTOR_DEMO_ID) return null;
  if (errorTypes.length === 0) return null;

  async function applyAll() {
    setState('applying');
    const applied: string[] = [];
    const failed: string[] = [];

    for (const errorType of errorTypes) {
      try {
        const res = await fetch(`/api/agents/${agentId}/apply-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorType, description: `Batch apply: ${errorType}` }),
        });
        if (res.ok) {
          applied.push(errorType);
        } else {
          failed.push(errorType);
        }
      } catch {
        failed.push(errorType);
      }
    }

    setResults({ applied, failed });
    setState(failed.length === errorTypes.length ? 'error' : 'done');
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-ok font-medium">
        ✓ {results.applied.length} fixed{results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="text-xs text-crit font-medium" title={errMsg}>
        ✗ All patches failed
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-ink-2">Apply {errorTypes.length} fixes to {agentName}?</span>
        <button
          onClick={applyAll}
          className="text-xs px-2 py-0.5 bg-crit hover:opacity-90 text-white rounded font-semibold transition-opacity"
        >
          Confirm
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
