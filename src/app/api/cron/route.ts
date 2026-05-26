/**
 * Cron endpoint — runs every hour via Vercel Cron
 * 1. Batch-analyzes up to 30 unanalyzed calls (backfill + new)
 * 2. Syncs latest 100 calls from Ultravox
 * 3. Runs alert rule check
 *
 * Secured by CRON_SECRET env var.
 */
import { NextResponse } from 'next/server';
import { runAlertCheck } from '@/lib/alert-engine';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeCall } from '@/lib/call-analyzer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — Vercel Pro

const BATCH_SIZE = 30;
const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = { analyzed: 0, errors: 0, alerts_fired: 0, remaining: 0, llama_queued: 0 };

  // ── 1. Batch analyze unanalyzed calls ──────────────────────────────────────
  const { data: calls, count } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status', { count: 'exact' })
    .eq('status', 'ended')
    .or('analysis_status.is.null,analysis_status.eq.pending,analysis_status.eq.error')
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE);

  results.remaining = Math.max(0, (count ?? 0) - BATCH_SIZE);

  const { queueAudioAnalysis } = await import('@/lib/audio-analyzer');
  let haikuDown = false; // once Haiku fails once, skip it for rest of batch

  for (const call of calls ?? []) {
    // If Haiku already confirmed down this run, route directly to Llama
    if (haikuDown) {
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ analysis_status: 'llama_pending' })
        .eq('call_id', call.call_id);
      queueAudioAnalysis(call.call_id, call.agent_id ?? null, call.client_name ?? 'Unknown', WEBHOOK_URL)
        .catch(() => { /* keep llama_pending */ });
      results.llama_queued++;
      continue;
    }

    try {
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ analysis_status: 'analyzing' })
        .eq('call_id', call.call_id);

      const { data: messages } = await supabaseAdmin
        .from('ultravox_messages')
        .select('role, text, ordinal')
        .eq('call_id', call.call_id)
        .order('ordinal', { ascending: true });

      const result = await analyzeCall({
        callId: call.call_id,
        agentId: call.agent_id ?? null,
        clientName: call.client_name ?? '',
        messages: messages ?? [],
        webhookUrl: WEBHOOK_URL,
      });

      if (result.haiku_failed) {
        // Haiku is down — flip flag, route this call and all remaining to Llama
        haikuDown = true;
        await supabaseAdmin
          .from('ultravox_calls')
          .update({ analysis_status: 'llama_pending' })
          .eq('call_id', call.call_id);
        queueAudioAnalysis(call.call_id, call.agent_id ?? null, call.client_name ?? 'Unknown', WEBHOOK_URL)
          .catch(() => { /* keep llama_pending */ });
        results.llama_queued++;
      } else {
        await supabaseAdmin
          .from('ultravox_calls')
          .update({
            call_errors:          result.analysis,
            analysis_status:      'complete',
            error_count:          result.analysis.error_count,
            critical_error_count: result.analysis.critical_error_count,
            prompt_hash:          result.prompt_hash ?? null,
          })
          .eq('call_id', call.call_id);
        results.analyzed++;
      }
    } catch {
      results.errors++;
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ analysis_status: 'error' })
        .eq('call_id', call.call_id);
    }
  }

  // ── 2. Retry llama_pending calls via Llama (never Haiku) ──────────────────
  const { data: llamaPending } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id')
    .eq('analysis_status', 'llama_pending')
    .order('created_at', { ascending: false })
    .limit(100);

  if (llamaPending && llamaPending.length > 0) {
    for (const call of llamaPending) {
      queueAudioAnalysis(
        call.call_id,
        call.agent_id ?? null,
        call.client_name ?? 'Unknown',
        WEBHOOK_URL,
      ).catch(() => { /* keep llama_pending — Llama will catch up */ });
      results.llama_queued++;
    }
  }

  // ── 3. Sync latest calls ───────────────────────────────────────────────────
  await fetch(`${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/sync`, {
    method: 'POST',
  }).catch(() => null);

  // ── 3. Alert check ─────────────────────────────────────────────────────────
  const alerts = await runAlertCheck().catch(() => []);
  results.alerts_fired = alerts.length;

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    haiku_down: haikuDown,
    ...results,
  });
}
