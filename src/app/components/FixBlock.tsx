'use client';

import { useState } from 'react';

interface Patch {
  label: string;
  find: string;
  replace: string;
  alreadyFixed: boolean;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 px-2 py-0.5 text-[11px] rounded border border-border text-ink-3 hover:border-border-strong hover:text-ink-2 transition-colors font-mono"
      title="Copy to clipboard"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

export function FixBlock({ patches }: { patches: Patch[] }) {
  return (
    <div className="mt-1.5 space-y-2.5">
      {patches.map((p, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden text-xs">

          {/* Label bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
            <span className="font-medium text-ink-2 text-[11px]">{p.label}</span>
            {p.alreadyFixed && (
              <span className="px-2 py-0.5 bg-ok-bg text-ok border border-ok-border rounded-md text-[10px] font-medium">
                ✓ Already fixed
              </span>
            )}
          </div>

          {p.alreadyFixed ? (
            <div className="px-3 py-2.5 text-ink-3 italic bg-surface text-[11px]">
              Patch already present in current prompt.
            </div>
          ) : (
            <>
              {/* Find */}
              <div className="border-b border-border">
                <div className="flex items-center justify-between px-3 py-1 bg-crit-bg border-b border-crit-border/50">
                  <span className="text-crit font-semibold uppercase tracking-wider text-[10px]">Find</span>
                  <CopyBtn text={p.find} />
                </div>
                <pre className="px-3 py-2 text-ink-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-canvas overflow-x-auto">
                  {p.find}
                </pre>
              </div>

              {/* Replace */}
              <div>
                <div className="flex items-center justify-between px-3 py-1 bg-ok-bg border-b border-ok-border/50">
                  <span className="text-ok font-semibold uppercase tracking-wider text-[10px]">Replace with</span>
                  <CopyBtn text={p.replace} />
                </div>
                <pre className="px-3 py-2 text-ink-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-canvas overflow-x-auto">
                  {p.replace}
                </pre>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
