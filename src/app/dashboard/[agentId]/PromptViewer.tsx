'use client';

import { useState } from 'react';

interface Props {
  prompt: string;
  agentName: string;
}

export function PromptViewer({ prompt, agentName }: Props) {
  const [open, setOpen] = useState(false);
  const lineCount = prompt.split('\n').length;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">
            {agentName} — System Prompt
          </span>
          <span className="text-xs text-ink-3">{lineCount} lines · {prompt.length.toLocaleString()} chars</span>
        </div>
        <span className="text-xs text-ink-3">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
        <div className="border-t border-border-subtle">
          <pre className="px-5 py-4 text-xs font-mono text-ink-2 leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}
