/**
 * Server-side utility for building OutcomeChart data.
 * No 'use client' — safe to import in server components.
 */

export interface RawCallForOutcome {
  created_at: string;
  call_errors: unknown;
}

export interface OutcomePoint {
  week: string;
  success: number;
  no_answer: number;
  not_interested: number;
  incomplete: number;
  no_save: number;
  other: number;
}

const KNOWN_OUTCOMES = new Set(['success', 'no_answer', 'not_interested', 'incomplete', 'no_save']);

export function buildOutcomeData(calls: RawCallForOutcome[], weeks = 12): OutcomePoint[] {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStarts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now - i * weekMs);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    weekStarts.push(d);
  }

  const buckets = new Map<number, OutcomePoint>();
  for (const ws of weekStarts) {
    const label = ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    buckets.set(ws.getTime(), { week: label, success: 0, no_answer: 0, not_interested: 0, incomplete: 0, no_save: 0, other: 0 });
  }

  for (const call of calls) {
    const callDate = new Date(call.created_at);
    const outcome = (call.call_errors as { goal_outcome?: string } | null)?.goal_outcome ?? 'other';
    const normalized = KNOWN_OUTCOMES.has(outcome) ? outcome : 'other';
    let targetWeek: number | null = null;
    for (let i = weekStarts.length - 1; i >= 0; i--) {
      if (callDate >= weekStarts[i]) { targetWeek = weekStarts[i].getTime(); break; }
    }
    if (targetWeek === null) continue;
    const bucket = buckets.get(targetWeek);
    if (!bucket) continue;
    (bucket as unknown as Record<string, number>)[normalized]++;
  }

  return [...buckets.values()].filter(
    (b) => b.success + b.no_answer + b.not_interested + b.incomplete + b.no_save + b.other > 0
  );
}
