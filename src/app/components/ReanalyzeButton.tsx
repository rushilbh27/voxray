'use client';
import { useState } from 'react';

interface Props {
  agentId:   string;
  agentName: string;
  limit?:    number;
}

type State = 'idle' | 'running' | 'done' | 'error';

export function ReanalyzeButton({ agentId, agentName, limit = 30 }: Props) {
  const [state, setState]   = useState<State>('idle');
  const [count, setCount]   = useState(0);
  const [errMsg, setErrMsg] = useState('');

  async function run() {
    setState('running');
    setErrMsg('');
    try {
      const res  = await fetch(`/api/agents/${agentId}/reanalyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Re-analyze failed');
      setCount(data.queued ?? 0);
      setState('done');
    } catch (e) {
      setErrMsg(String(e).replace('Error: ', ''));
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span className="text-xs text-ok font-medium">
        ✓ {count} calls re-analyzing — refresh in ~60s
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="text-xs text-crit font-medium" title={errMsg}>
        ✗ {errMsg.slice(0, 50)}{errMsg.length > 50 ? '…' : ''}
      </span>
    );
  }

  return (
    <button
      onClick={run}
      disabled={state === 'running'}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 border border-border text-ink-2 hover:border-ink-3 hover:text-ink rounded-md transition-colors disabled:opacity-50"
    >
      {state === 'running' ? (
        <>⏳ Re-analyzing…</>
      ) : (
        <>🔄 Re-analyze last {limit} calls</>
      )}
    </button>
  );
}
