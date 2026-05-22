/**
 * Repeat Error Tracker
 *
 * Core philosophy: an error firing once is acceptable — it's learning.
 * The same error firing again (especially after a fix was available) = broken loop.
 *
 * After each call analysis, this checks how many times each detected error type
 * has fired for this agent in the last 30 days. If it crosses REPEAT_THRESHOLD,
 * fires a targeted Telegram alert with specific action (apply fix / fix regressed / write patch).
 *
 * Called from webhook/call-ended after analysis — non-blocking, fire-and-forget.
 */
import { supabaseAdmin } from './supabase';
import { FIX_SPECS } from './fix-specs';
import type { CallError } from './error-analyzer';

/** How many times an error must fire (including current call) before it's flagged as recurring */
const REPEAT_THRESHOLD = 3;

/** Look-back window for counting past occurrences */
const WINDOW_DAYS = 30;

export interface RepeatErrorResult {
  type: string;
  /** Total occurrences in window including current call */
  total_count: number;
  /** True if a prompt patch is defined for this error type */
  has_fix: boolean;
  /** True if a fix was previously applied for this agent + error type */
  fix_was_applied: boolean;
  /** ISO timestamp of when the fix was applied, if available */
  fix_applied_at: string | null;
}

async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });
}

/**
 * For each error in currentErrors, counts how many times that error type
 * fired for this agent in the last WINDOW_DAYS days (excluding the current call).
 *
 * Returns only errors that meet REPEAT_THRESHOLD.
 * Sends a Telegram alert with targeted action for each.
 */
export async function checkRepeatErrors(
  callId: string,
  agentId: string | null,
  agentName: string,
  currentErrors: CallError[],
): Promise<RepeatErrorResult[]> {
  if (!agentId || currentErrors.length === 0) return [];

  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Fetch recent analyzed calls for this agent (exclude current call to avoid double-counting)
  const { data: recentCalls, error: fetchErr } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_errors')
    .eq('agent_id', agentId)
    .neq('call_id', callId)
    .eq('analysis_status', 'complete')
    .gte('created_at', since)
    .range(0, 499); // cap at 500 calls; ~30 days of a busy agent

  if (fetchErr || !recentCalls || recentCalls.length === 0) return [];

  // Count each error_type across past calls (once per call, not per occurrence in that call)
  const pastCounts = new Map<string, number>();
  for (const call of recentCalls) {
    const errors =
      (
        call.call_errors as {
          errors?: Array<{ type: string }>;
        } | null
      )?.errors ?? [];
    const seenInThisCall = new Set<string>();
    for (const e of errors) {
      if (!seenInThisCall.has(e.type)) {
        seenInThisCall.add(e.type);
        pastCounts.set(e.type, (pastCounts.get(e.type) ?? 0) + 1);
      }
    }
  }

  // Unique error types in current call
  const currentTypes = [...new Set(currentErrors.map((e) => e.type))];

  // Check fix log for this agent — batch lookup
  const { data: fixLogs } = await supabaseAdmin
    .from('prompt_fixes')
    .select('error_type, applied_at')
    .eq('agent', agentName)
    .order('applied_at', { ascending: false });

  const fixLogMap = new Map<string, string>(); // error_type → most recent applied_at
  for (const f of fixLogs ?? []) {
    if (!fixLogMap.has(f.error_type as string)) {
      fixLogMap.set(f.error_type as string, f.applied_at as string);
    }
  }

  // Identify recurring errors
  const repeats: RepeatErrorResult[] = [];
  for (const errorType of currentTypes) {
    const pastCount = pastCounts.get(errorType) ?? 0;
    const totalCount = pastCount + 1; // +1 for current call

    if (totalCount >= REPEAT_THRESHOLD) {
      const hasFix = !!(FIX_SPECS[errorType]?.patches?.length);
      const fixAppliedAt = fixLogMap.get(errorType) ?? null;

      repeats.push({
        type: errorType,
        total_count: totalCount,
        has_fix: hasFix,
        fix_was_applied: !!fixAppliedAt,
        fix_applied_at: fixAppliedAt,
      });
    }
  }

  if (repeats.length === 0) return repeats;

  // Fire Telegram alert
  const lines: string[] = [
    `🔁 <b>Repeat Errors Detected — ${agentName}</b>`,
    `<i>${repeats.length} error type${repeats.length > 1 ? 's' : ''} keep${repeats.length === 1 ? 's' : ''} firing</i>`,
    '',
  ];

  for (const r of repeats) {
    if (r.fix_was_applied) {
      // Most dangerous: fix was applied but error came back
      const appliedDate = r.fix_applied_at
        ? new Date(r.fix_applied_at).toLocaleDateString()
        : 'unknown date';
      lines.push(
        `🚨 <b>FIX REGRESSION: ${r.type}</b>\n` +
        `   Fix applied on ${appliedDate} — but error fired ${r.total_count}x in ${WINDOW_DAYS}d\n` +
        `   → Patch may not have matched live prompt. Re-verify find text.`,
      );
    } else if (r.has_fix) {
      // Fix available but not yet applied
      lines.push(
        `⚠️ <b>${r.type}</b> — ${r.total_count}x in ${WINDOW_DAYS}d\n` +
        `   Patch available but not applied — agent keeps making this mistake.\n` +
        `   → Apply now: https://voxray.vercel.app/dashboard`,
      );
    } else {
      // No fix defined yet
      lines.push(
        `🟡 <b>${r.type}</b> — ${r.total_count}x in ${WINDOW_DAYS}d\n` +
        `   No patch defined. Write a fix-spec for this error type.`,
      );
    }
    lines.push('');
  }

  await sendTelegram(lines.join('\n'));
  return repeats;
}
