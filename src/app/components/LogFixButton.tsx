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
        className="text-xs text-blue-600 hover:text-blue-800 underline"
      >
        Log fix
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Log Prompt Fix</h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-mono text-gray-700">{errorType}</span> · {agentName}
            </p>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What did you change in the prompt? (optional)"
              className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:border-gray-400"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium"
              >
                {saving ? 'Saving…' : 'Log fix (today)'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
