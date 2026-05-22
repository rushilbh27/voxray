import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  fetchAllCalls,
  fetchCalls,
  fetchCallMessages,
  fetchCallTools,
  getClientName,
  calcCostUsd,
} from '../src/lib/ultravox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

function parseDurationSeconds(d: string | null | undefined): number {
  if (!d) return 0;
  return parseFloat(d.replace('s', '')) || 0;
}

const fullSync = process.argv.includes('--full');

async function syncCalls() {
  console.log(`Starting Ultravox call sync (${fullSync ? 'FULL' : 'recent 100'})...`);

  const calls = fullSync ? await fetchAllCalls() : await fetchCalls(100);
  console.log(`Found ${calls.length} calls from Ultravox`);

  // Get existing call IDs with message counts to skip re-fetching
  const { data: existing } = await supabase
    .from('ultravox_calls')
    .select('call_id');
  const existingIds = new Set((existing || []).map((r) => r.call_id));

  // Batch upsert calls in chunks of 100
  const BATCH = 100;
  let synced = 0;
  let msgTotal = 0;

  for (let i = 0; i < calls.length; i += BATCH) {
    const batch = calls.slice(i, i + BATCH);
    const rows = batch.map((call) => {
      const agentId = call.agentId ?? call.agent?.agentId ?? null;
      const agentName = call.agent?.name ?? null;
      const durationSeconds = parseDurationSeconds(call.billedDuration);
      const systemPrompt = (call as Record<string, unknown>).systemPrompt as string | null;
      return {
        call_id: call.callId,
        agent_id: agentId,
        status: call.ended ? 'ended' : 'active',
        duration_seconds: durationSeconds,
        cost_usd: calcCostUsd(durationSeconds),
        ended_reason: call.endReason ?? null,
        client_name: getClientName(agentId, agentName, systemPrompt),
        created_at: call.created,
        ended_at: call.ended ?? null,
        raw_data: call,
      };
    });

    const { error } = await supabase
      .from('ultravox_calls')
      .upsert(rows, { onConflict: 'call_id' });
    if (error) {
      console.error(`Batch error at ${i}:`, error.message);
    }
    synced += batch.length;
    console.log(`  Synced ${synced}/${calls.length} calls`);
  }

  // Fetch messages — in full mode, only for NEW calls (not already in DB)
  const endedCalls = calls.filter((c) => !!c.ended);
  const callsNeedingMessages = fullSync
    ? endedCalls.filter((c) => !existingIds.has(c.callId))
    : endedCalls;

  console.log(`\nFetching messages for ${callsNeedingMessages.length} calls (skipping ${endedCalls.length - callsNeedingMessages.length} already synced)...`);

  for (let i = 0; i < callsNeedingMessages.length; i++) {
    const call = callsNeedingMessages[i];
    try {
      const messages = await fetchCallMessages(call.callId);
      if (messages.length > 0) {
        const rows = messages.map((msg) => ({
          call_id: call.callId,
          role: msg.role,
          text: msg.text || '',
          ordinal: msg.callStageMessageIndex ?? 0,
          created_at: new Date().toISOString(),
        }));
        const { error: msgError } = await supabase
          .from('ultravox_messages')
          .upsert(rows, { onConflict: 'call_id,ordinal' });
        if (msgError) console.error(`  Msg error ${call.callId}:`, msgError.message);
        msgTotal += messages.length;
      }

      const tools = await fetchCallTools(call.callId);
      if (tools.length > 0) {
        for (const tool of tools) {
          await supabase.from('ultravox_tools').upsert({
            call_id: call.callId,
            tool_name: tool.name,
            parameters: tool.parameters,
            result: tool.result,
            invocation_time: tool.invocationTime,
            status: tool.result ? 'success' : 'error',
            error_message: tool.errorMessage,
          });
        }
      }
    } catch (err) {
      console.error(`  Error fetching details for ${call.callId}:`, err);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Messages: ${i + 1}/${callsNeedingMessages.length} calls processed (${msgTotal} messages total)`);
    }
  }

  console.log(`\nSync complete! ${synced} calls, ${msgTotal} new messages`);
}

syncCalls().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
