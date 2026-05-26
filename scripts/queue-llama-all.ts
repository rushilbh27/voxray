/**
 * Queue Llama audio analysis for all un-analyzed calls.
 * Run when Haiku is down: npx tsx scripts/queue-llama-all.ts
 *
 * Fetches pending/error calls from Supabase, sends each recording to the
 * self-hosted Llama server. Results arrive async via /api/webhook/transcript.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { queueAudioAnalysis, RecordingNotFoundError } from '../src/lib/audio-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;
const CONCURRENCY  = 2;   // parallel uploads to Llama — don't overwhelm it
const DELAY_MS     = 3000; // pause between batches

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  // Fetch all calls that need analysis
  const { data: calls, error } = await supabase
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status')
    .eq('status', 'ended')
    .or('analysis_status.eq.pending,analysis_status.eq.error,analysis_status.eq.llama_pending,analysis_status.is.null')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) { console.error('Supabase error:', error); process.exit(1); }
  if (!calls || calls.length === 0) { console.log('No pending calls found.'); return; }

  console.log(`Found ${calls.length} calls to queue.\n`);

  let queued = 0, skipped = 0, failed = 0;

  for (let i = 0; i < calls.length; i += CONCURRENCY) {
    const batch = calls.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (call) => {
      try {
        // Mark as llama_pending so webhook saves errors when Llama responds
        await supabase
          .from('ultravox_calls')
          .update({ analysis_status: 'llama_pending' })
          .eq('call_id', call.call_id);

        await queueAudioAnalysis(
          call.call_id,
          call.agent_id ?? null,
          call.client_name ?? 'Unknown',
          WEBHOOK_URL,
        );

        console.log(`✅  ${call.call_id} — ${call.client_name}`);
        queued++;
      } catch (err) {
        if (err instanceof RecordingNotFoundError) {
          console.log(`⏭️   ${call.call_id} — no recording (skipped)`);
          // Revert to error so cron doesn't keep retrying
          await supabase
            .from('ultravox_calls')
            .update({ analysis_status: 'error' })
            .eq('call_id', call.call_id);
          skipped++;
        } else {
          console.error(`❌  ${call.call_id} — ${err instanceof Error ? err.message : err}`);
          failed++;
        }
      }
    }));

    const done = Math.min(i + CONCURRENCY, calls.length);
    console.log(`   [${done}/${calls.length}] queued=${queued} skipped=${skipped} failed=${failed}`);

    if (done < calls.length) await sleep(DELAY_MS);
  }

  console.log(`\nDone. queued=${queued} skipped=${skipped} failed=${failed}`);
  console.log('Llama results arrive via webhook — check /dashboard in ~2-5 min per call.');
}

run().catch(console.error);
