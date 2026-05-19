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
      className="shrink-0 px-2 py-0.5 text-xs rounded border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

export function FixBlock({ patches }: { patches: Patch[] }) {
  return (
    <div className="mt-1.5 space-y-3">
      {patches.map((p, i) => (
        <div key={i} className="rounded border border-gray-200 overflow-hidden text-xs">
          {/* Label */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="font-medium text-gray-700">{p.label}</span>
            {p.alreadyFixed && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                ✓ Already fixed
              </span>
            )}
          </div>

          {p.alreadyFixed ? (
            <div className="px-3 py-2 text-gray-400 italic">
              This text is no longer in the current prompt — fix was already applied.
            </div>
          ) : (
            <>
              {/* Find */}
              <div className="border-b border-gray-200">
                <div className="flex items-center justify-between px-3 py-1 bg-red-50">
                  <span className="text-red-600 font-semibold uppercase tracking-wide text-[10px]">Find</span>
                  <CopyBtn text={p.find} />
                </div>
                <pre className="px-3 py-2 text-gray-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-red-50/30 overflow-x-auto">
                  {p.find}
                </pre>
              </div>

              {/* Replace */}
              <div>
                <div className="flex items-center justify-between px-3 py-1 bg-green-50">
                  <span className="text-green-700 font-semibold uppercase tracking-wide text-[10px]">Replace with</span>
                  <CopyBtn text={p.replace} />
                </div>
                <pre className="px-3 py-2 text-gray-700 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-green-50/30 overflow-x-auto">
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
