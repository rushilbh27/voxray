import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api';
const LLM_SERVER = 'http://72.61.206.216:8000/process-call';

// Pass your deployed webhook URL as arg: npx tsx scripts/process-transcripts.ts https://voxray.vercel.app/api/webhook/transcript
const webhookUrl = process.argv[2];
if (!webhookUrl) {
  console.error('Usage: npx tsx scripts/process-transcripts.ts <webhook_url>');
  console.error('Example: npx tsx scripts/process-transcripts.ts https://voxray.vercel.app/api/webhook/transcript');
  process.exit(1);
}

const CONCURRENCY = 3;
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processCall(callId: string, clientName: string): Promise<boolean> {
  try {
    // Fetch recording from Ultravox
    const recordingRes = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/recording`, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    });

    if (!recordingRes.ok) {
      console.log(`  ✗ ${callId} — no recording (${recordingRes.status})`);
      await supabase
        .from('ultravox_calls')
        .update({ transcript_status: 'no_recording' })
        .eq('call_id', callId);
      return false;
    }

    const audioBlob = await recordingRes.blob();
    if (audioBlob.size < 1000) {
      console.log(`  ✗ ${callId} — recording too small (${audioBlob.size} bytes)`);
      await supabase
        .from('ultravox_calls')
        .update({ transcript_status: 'no_recording' })
        .eq('call_id', callId);
      return false;
    }

    // Send to LLM server
    const form = new FormData();
    form.append('file', audioBlob, `${callId}.wav`);
    form.append('webhook_url', webhookUrl);
    form.append('uid', clientName);
    form.append('call_id', callId);
    form.append(
      'system_prompt',
      'You are a data extractor. Read the transcript and extract the details. Do not output anything else.'
    );
    form.append(
      'required_fields',
      JSON.stringify({
        customer_name: "Look for the customer's name mentioned in the call. Put that name here.",
        agent_name: "Look for the agent's name mentioned in the call. Put that name here.",
        call_purpose: 'What was the main purpose of this call? Summarize in one sentence.',
        outcome: 'What was the outcome of the call? Did the customer get what they needed?',
        sentiment: 'Was the customer satisfied, neutral, or dissatisfied?',
      })
    );

    const llmRes = await fetch(LLM_SERVER, { method: 'POST', body: form });
    const llmData = await llmRes.json();

    if (llmData.status === 'queued') {
      await supabase
        .from('ultravox_calls')
        .update({ transcript_status: 'processing' })
        .eq('call_id', callId);
      console.log(`  ✓ ${callId} — queued for processing`);
      return true;
    } else {
      console.log(`  ✗ ${callId} — LLM server error:`, llmData);
      return false;
    }
  } catch (err) {
    console.error(`  ✗ ${callId} — error:`, (err as Error).message);
    await supabase
      .from('ultravox_calls')
      .update({
        transcript_status: 'error',
        transcript_error: (err as Error).message,
      })
      .eq('call_id', callId);
    return false;
  }
}

async function main() {
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log('Finding calls needing transcript processing...\n');

  // Get all ended calls with duration > 0, not unjoined, not already processed
  const { data: allCalls } = await supabase
    .from('ultravox_calls')
    .select('call_id, client_name, duration_seconds, ended_reason, transcript_status, raw_data')
    .eq('status', 'ended')
    .gt('duration_seconds', 5)
    .neq('ended_reason', 'unjoined')
    .order('created_at', { ascending: false });

  // SIP = recordings always on. WebRTC = only recent calls have recordings.
  const sipOnly = process.argv.includes('--sip-only');

  const needsProcessing = (allCalls || []).filter((c) => {
    if (c.transcript_status === 'complete' || c.transcript_status === 'processing') return false;
    if (sipOnly) {
      const rd = c.raw_data as Record<string, unknown>;
      const medium = rd?.medium as Record<string, unknown> | undefined;
      return !!medium?.sip;
    }
    return true;
  });

  console.log(`Found ${needsProcessing.length} calls needing processing\n`);

  if (needsProcessing.length === 0) {
    console.log('Nothing to process!');
    return;
  }

  let queued = 0;
  let failed = 0;

  for (let i = 0; i < needsProcessing.length; i++) {
    const call = needsProcessing[i];
    const success = await processCall(call.call_id, call.client_name);
    if (success) queued++;
    else failed++;

    if ((i + 1) % 10 === 0) {
      console.log(`\nProgress: ${i + 1}/${needsProcessing.length} (${queued} queued, ${failed} failed)\n`);
    }

    // Rate limit — don't overwhelm LLM server
    await sleep(DELAY_MS);
  }

  console.log(`\nDone! ${queued} queued, ${failed} failed out of ${needsProcessing.length}`);
}

main().catch((err) => {
  console.error('Process failed:', err);
  process.exit(1);
});
