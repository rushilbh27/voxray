'use client';
import { useState } from 'react';

interface Props {
  agentId:     string;
  agentName:   string;
  errorType:   string;
  description?: string;
}

type State = 'idle' | 'confirming' | 'applying' | 'done' | 'already_applied' | 'error';

export function ApplyFixButton({ agentId, agentName, errorType, description }: Props) {
  const [state, setState]   = useState<State>('idle');
  const [errMsg, setErrMsg] = useState('');

  async function apply() {
    setState('applying');
    setErrMsg('');
    try {
      const res = await fetch(`/api/agents/${agentId}/apply-fix`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ errorType, description }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setState('already_applied');
      } else if (!res.ok) {
        throw new Error(data.error ?? 'Apply failed');
      } else {
        setState('done');
      }
    } catch (e) {
      setErrMsg(String(e).replace('Error: ', ''));
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ok font-medium">
        ✓ Patched — {agentName}
      </span>
    );
  }

  if (state === 'already_applied') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ok font-medium">
        ✓ Already applied
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-crit font-medium cursor-help"
        title={errMsg}
      >
        ✗ Failed — {errMsg.slice(0, 60)}{errMsg.length > 60 ? '…' : ''}
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <span className="text-xs text-ink">
          Patch <span className="font-mono text-warn">{errorType}</span> on <span className="font-semibold">{agentName}</span>?
        </span>
        <button
          onClick={apply}
          className="text-xs px-2.5 py-0.5 bg-crit hover:opacity-90 text-white rounded font-semibold transition-opacity"
        >
          Yes, patch it
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
      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 border border-accent-border text-accent bg-accent-bg hover:bg-accent rounded-md font-medium transition-colors disabled:opacity-50 hover:text-white"
    >
      {state === 'applying' ? '⏳ Applying…' : '⚡ Apply fix'}
    </button>
  );
}
