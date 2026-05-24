'use client';

import { useState } from 'react';

const COLLAPSE_THRESHOLD = 300;

interface TranscriptMessageProps {
  text: string;
  isAgent: boolean;
  isTool: boolean;
  hasCrit: boolean;
  hasErr: boolean;
}

export function TranscriptMessage({ text, isAgent, isTool, hasCrit, hasErr }: TranscriptMessageProps) {
  const isLong = text.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLong && !expanded ? text.slice(0, COLLAPSE_THRESHOLD) : text;

  const bubbleCls = hasCrit
    ? 'bg-crit-bg text-ink border border-crit-border'
    : hasErr
    ? 'bg-warn-bg text-ink border border-warn-border'
    : isTool
    ? 'bg-warn-bg text-warn font-mono text-xs border border-warn-border'
    : isAgent
    ? 'bg-accent-bg text-ink border border-accent-border'
    : 'bg-surface-2 text-ink border border-border';

  const avatarCls = isTool
    ? 'bg-warn-bg text-warn border border-warn-border'
    : isAgent
    ? 'bg-accent-bg text-accent border border-accent-border'
    : 'bg-surface-2 text-ink-2 border border-border';

  return (
    <div className={`flex gap-2.5 ${isAgent || isTool ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${avatarCls}`}>
        {isTool ? '⚙' : isAgent ? 'A' : 'U'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] sm:max-w-[82%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${bubbleCls}`}>
        {isTool && (
          <div className="text-[10px] text-warn mb-1 uppercase tracking-wide font-sans font-semibold">Tool</div>
        )}
        <span className="whitespace-pre-wrap break-words">{displayText}</span>
        {isLong && !expanded && (
          <span className="text-[11px] text-ink-3">…</span>
        )}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="block mt-1.5 text-[11px] text-accent hover:underline focus:outline-none"
          >
            {expanded ? '↑ show less' : '↓ show more'}
          </button>
        )}
      </div>
    </div>
  );
}
