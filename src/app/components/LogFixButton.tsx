'use client';
import { useState } from 'react';

interface Props {
  agentName: string;
  errorType: string;
}

export function LogFixButton({ agentName, errorType }: Props) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/fixes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: agentName, error_type: errorType, fix_description: desc }),
    });
    setSaving(false);
    setDone(true);
    setOpen(false);
  }

  if (done) return <span className="text-xs text-green-600 font-medium">✓ Fix logged</span>;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:underline transition-colors"
      >
        log fix
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={submit} className="bg-canvas border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-ink mb-1 text-lg">Log Prompt Fix</h3>
            <p className="text-sm text-ink-2 mb-4 pb-4 border-b border-border-subtle">
              <span className="font-mono font-medium text-ink bg-surface px-1.5 py-0.5 rounded border border-border">{errorType}</span>
              <span className="mx-2 text-ink-3">·</span>
              {agentName}
            </p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What did you change in the prompt? (optional)"
              className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-ink resize-none h-24 focus:outline-none focus:border-accent transition-colors"
            />
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-semibold text-ink-2 bg-surface hover:bg-surface-2 border border-border rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-ink text-canvas rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Log fix (today)'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
