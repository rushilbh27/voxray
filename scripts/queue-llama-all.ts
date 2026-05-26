/**
 * Queue Llama audio analysis for all un-analyzed calls.
 * Run when Haiku is down: npx tsx scripts/queue-llama-all.ts
 *
 * - Retries each call up to 3x before giving up
 * - NEVER marks calls as 'error' — keeps as 'llama_pending' so cron retries via Llama
 * - Never touches Haiku
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { queueAudioAnalysis, RecordingNotFoundError } from '../src/lib/audio-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

const WEBHOOK_URL  = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;
const CONCURRENCY  = 2;     // 2 parallel — Llama is single-GPU, queue it gently
const BATCH_DELAY  = 5_000; // 5s between batches — give Llama breathing room
const MAX_RETRIES  = 3;
const RETRY_DELAY  = 15_000; // 15s before retry — let Llama clear its queue

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function queueWithRetry(
  callId: string,
  agentId: string | null,
  clientName: string,
): Promise<'queued' | 'no_recording' | 'failed'> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await queueAudioAnalysis(callId, agentId, clientName, WEBHOOK_URL);
      return 'queued';
    } catch (err) {
      if (err instanceof RecordingNotFoundError) {
        return 'no_recording';
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`);
      if (attempt < MAX_RETRIES) {
        console.log(`   ⏳ waiting ${RETRY_DELAY / 1000}s before retry...`);
        await sleep(RETRY_DELAY);
      }
    }
  }
  return 'failed';
}

async function run() {
  const { data: calls, error } = await supabase
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status')
    .eq('status', 'ended')
    .or('analysis_status.eq.pending,analysis_status.eq.error,analysis_status.eq.llama_pending,analysis_status.is.null')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) { console.error('Supabase error:', error); process.exit(1); }
  if (!calls || calls.length === 0) { console.log('No pending calls found — all good.'); return; }

  console.log(`Queueing ${calls.length} calls to Llama (${CONCURRENCY} concurrent).\n`);

  const stats = { queued: 0, no_recording: 0, failed: 0 };

  for (let i = 0; i < calls.length; i += CONCURRENCY) {
    const batch = calls.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (call) => {
      // Mark as llama_pending BEFORE queuing so webhook knows to save errors
      await supabase
        .from('ultravox_calls')
        .update({ analysis_status: 'llama_pending' })
        .eq('call_id', call.call_id);

      const result = await queueWithRetry(
        call.call_id,
        call.agent_id ?? null,
        call.client_name ?? 'Unknown',
      );

      if (result === 'queued') {
        console.log(`✅  ${call.call_id}  ${call.client_name}`);
        stats.queued++;
      } else if (result === 'no_recording') {
        // No audio available — nothing Llama can do, mark skipped
        console.log(`⏭️   ${call.call_id}  no recording`);
        await supabase
          .from('ultravox_calls')
          .update({ analysis_status: 'skipped' })
          .eq('call_id', call.call_id);
        stats.no_recording++;
      } else {
        // All retries failed — keep llama_pending so cron picks it up later via Llama
        console.log(`❌  ${call.call_id}  all retries failed — keeping llama_pending`);
        stats.failed++;
      }
    }));

    const done = Math.min(i + CONCURRENCY, calls.length);
    console.log(`   [${done}/${calls.length}]  queued=${stats.queued}  skipped=${stats.no_recording}  failed=${stats.failed}\n`);

    if (done < calls.length) await sleep(BATCH_DELAY);
  }

  console.log('─'.repeat(50));
  console.log(`Done.  queued=${stats.queued}  no_recording=${stats.no_recording}  failed=${stats.failed}`);
  console.log(`Results arrive async via webhook — check /dashboard in a few minutes.`);
}

run().catch(console.error);
