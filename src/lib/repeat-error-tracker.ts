/**
 * Repeat Error Tracker
 *
 * Core philosophy: an error firing once is acceptable — it's learning.
 * The same error firing again (especially after a fix was available) = broken loop.
 *
 * After each call analysis, checks how many times each detected error type
 * has fired for this agent in the last 30 days. If it crosses REPEAT_THRESHOLD:
 *   - FIX REGRESSION: fix was applied but error came back → urgent
 *   - Fix available but not applied → send apply-now alert
 *   - FP rate < 5% + error count >= 5 → auto-apply (allowlisted agents only)
 *   - No fix defined → write-patch alert
 *
 * Called from webhook/call-ended after analysis — non-blocking, fire-and-forget.
 */
import { supabaseAdmin } from './supabase';
import { FIX_SPECS, verifyPatch } from './fix-specs';
import { sendTelegram } from './telegram';
import type { TelegramButton } from './telegram';
import type { CallError } from './error-analyzer';

/** How many times an error must fire (including current call) before it's flagged */
const REPEAT_THRESHOLD = 3;

/** Look-back window for counting past occurrences */
const WINDOW_DAYS = 30;

/** FP rate below this → consider auto-apply */
const AUTO_APPLY_FP_THRESHOLD = 0.05; // 5%

/** Minimum eval data points needed to trust FP rate */
const MIN_EVAL_SAMPLES = 10;

/** Agents allowed to receive automated prompt patches */
const AUTO_APPLY_ALLOWLIST = new Set([
  '428d7591-3ba5-4b60-8aa5-a92012d12451', // NECTOR Demo
  '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81', // Davansh Investment
]);

const ULTRAVOX_API = 'https://api.ultravox.ai/api';
const BASE_URL = process.env.VOXRAY_URL ?? 'https://voxray.vercel.app';

export interface RepeatErrorResult {
  type: string;
  total_count: number;
  has_fix: boolean;
  fix_was_applied: boolean;
  fix_applied_at: string | null;
  auto_applied: boolean;
}

// ── Internal: apply patch directly without HTTP round-trip ────────────────────
async function applyPatchInternal(
  agentId: string,
  agentName: string,
  errorType: string,
): Promise<boolean> {
  try {
    const spec = FIX_SPECS[errorType];
    if (!spec || spec.patches.length === 0) return false;

    // GET current agent
    const getRes = await fetch(`${ULTRAVOX_API}/agents/${agentId}`, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    });
    if (!getRes.ok) return false;

    const agent = await getRes.json();
    const currentPrompt: string = agent.callTemplate?.systemPrompt ?? '';

    // Verify + apply patches
    let newPrompt = currentPrompt;
    let anyApplied = false;
    for (const patch of spec.patches) {
      const { exists } = verifyPatch(patch, currentPrompt);
      if (exists && newPrompt.includes(patch.find)) {
        newPrompt = newPrompt.replace(patch.find, patch.replace);
        anyApplied = true;
      }
    }
    if (!anyApplied) return false;

    // PATCH back
    const patchRes = await fetch(`${ULTRAVOX_API}/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': process.env.ULTRAVOX_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callTemplate: { ...agent.callTemplate, systemPrompt: newPrompt },
      }),
    });
    if (!patchRes.ok) return false;

    // Log the fix
    await supabaseAdmin.from('prompt_fixes').insert({
      agent:       agentName,
      error_type:  errorType,
      description: `Auto-applied by repeat-error-tracker (FP rate < 5%, error repeated ${REPEAT_THRESHOLD}+ times)`,
      applied_at:  new Date().toISOString(),
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * For each error in currentErrors, counts occurrences for this agent in last
 * WINDOW_DAYS days. Fires Telegram alert for recurring errors.
 * Auto-applies patches for allowlisted agents when FP rate is low enough.
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

  // Fetch recent calls for this agent (exclude current)
  const { data: recentCalls, error: fetchErr } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_errors')
    .eq('agent_id', agentId)
    .neq('call_id', callId)
    .eq('analysis_status', 'complete')
    .gte('created_at', since)
    .range(0, 499);

  if (fetchErr || !recentCalls || recentCalls.length === 0) return [];

  // Count each error_type across past calls (once per call)
  const pastCounts = new Map<string, number>();
  for (const call of recentCalls) {
    const errors =
      (call.call_errors as { errors?: Array<{ type: string }> } | null)?.errors ?? [];
    const seenInCall = new Set<string>();
    for (const e of errors) {
      if (!seenInCall.has(e.type)) {
        seenInCall.add(e.type);
        pastCounts.set(e.type, (pastCounts.get(e.type) ?? 0) + 1);
      }
    }
  }

  // Fetch fix log for this agent
  const { data: fixLogs } = await supabaseAdmin
    .from('prompt_fixes')
    .select('error_type, applied_at')
    .eq('agent', agentName)
    .order('applied_at', { ascending: false });

  const fixLogMap = new Map<string, string>();
  for (const f of fixLogs ?? []) {
    if (!fixLogMap.has(f.error_type as string)) {
      fixLogMap.set(f.error_type as string, f.applied_at as string);
    }
  }

  // Fetch eval stats for FP rate check
  const { data: evalRows } = await supabaseAdmin.rpc('get_eval_stats');
  const evalMap = new Map<string, { total_flags: number; fp_count: number }>(
    ((evalRows as Array<Record<string, unknown>>) ?? []).map((r) => [
      r.error_type as string,
      { total_flags: Number(r.total_flags), fp_count: Number(r.fp_count) },
    ])
  );

  const currentTypes = [...new Set(currentErrors.map((e) => e.type))];
  const results: RepeatErrorResult[] = [];
  const alertBlocks: string[] = [];
  const buttons: TelegramButton[] = [];

  for (const errorType of currentTypes) {
    const pastCount = pastCounts.get(errorType) ?? 0;
    const totalCount = pastCount + 1; // include current call

    if (totalCount < REPEAT_THRESHOLD) continue;

    const hasFix = !!(FIX_SPECS[errorType]?.patches?.length);
    const fixAppliedAt = fixLogMap.get(errorType) ?? null;
    const evalStats = evalMap.get(errorType);
    const fpRate = evalStats && evalStats.total_flags >= MIN_EVAL_SAMPLES
      ? evalStats.fp_count / evalStats.total_flags
      : null;
    const canAutoApply =
      hasFix &&
      AUTO_APPLY_ALLOWLIST.has(agentId) &&
      fpRate !== null &&
      fpRate < AUTO_APPLY_FP_THRESHOLD;

    let autoApplied = false;

    if (canAutoApply && !fixAppliedAt) {
      // Conditions met: allowlisted agent + high precision + recurring → auto-apply
      autoApplied = await applyPatchInternal(agentId, agentName, errorType);
    }

    results.push({
      type: errorType,
      total_count: totalCount,
      has_fix: hasFix,
      fix_was_applied: !!fixAppliedAt,
      fix_applied_at: fixAppliedAt,
      auto_applied: autoApplied,
    });

    // Build alert block for this error
    const precisionNote = fpRate !== null
      ? ` (${Math.round((1 - fpRate) * 100)}% precision)`
      : '';

    if (autoApplied) {
      alertBlocks.push(
        `✅ <b>AUTO-FIXED: ${errorType}</b>\n` +
        `   Fired ${totalCount}x in ${WINDOW_DAYS}d${precisionNote}\n` +
        `   Patch automatically applied — no action needed.`
      );
    } else if (fixAppliedAt) {
      const appliedDate = new Date(fixAppliedAt).toLocaleDateString();
      alertBlocks.push(
        `🚨 <b>FIX REGRESSION: ${errorType}</b>\n` +
        `   Fix applied ${appliedDate} but error fired ${totalCount}x in ${WINDOW_DAYS}d\n` +
        `   → Patch may not match live prompt. Re-verify find text.`
      );
    } else if (hasFix) {
      const urgency = fpRate !== null
        ? ` | ${Math.round((1 - fpRate) * 100)}% precision — safe to apply`
        : '';
      alertBlocks.push(
        `⚠️ <b>${errorType}</b> — ${totalCount}x in ${WINDOW_DAYS}d${urgency}\n` +
        `   Patch available but NOT applied. Agent repeating this mistake.`
      );
    } else {
      alertBlocks.push(
        `🟡 <b>${errorType}</b> — ${totalCount}x in ${WINDOW_DAYS}d\n` +
        `   No patch defined. Write a fix-spec for this error type.`
      );
    }
  }

  if (results.length === 0) return results;

  // Add profile button for this agent
  buttons.push({
    text: `→ ${agentName} profile`,
    url: `${BASE_URL}/dashboard/${agentId}`,
  });

  const message = [
    `🔁 <b>Repeat Errors — ${agentName}</b>`,
    `<i>${results.length} error type${results.length > 1 ? 's' : ''} recurring</i>`,
    '',
    ...alertBlocks.flatMap((b) => [b, '']),
  ].join('\n');

  await sendTelegram(message, buttons);
  return results;
}
