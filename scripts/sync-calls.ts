import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  fetchCalls,
  fetchCallMessages,
  fetchCallTools,
  getClientName,
  calcCostUsd,
} from '../src/lib/ultravox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } }
);

// Parse billed duration string like "120.5s" → seconds
function parseDurationSeconds(d: string | null | undefined): number {
  if (!d) return 0;
  return parseFloat(d.replace('s', '')) || 0;
}

async function syncCalls() {
  console.log('Starting Ultravox call sync...');

  const calls = await fetchCalls(100);
  console.log(`Found ${calls.length} calls from Ultravox`);

  for (const call of calls) {
    const isEnded = !!call.ended;
    const agentId = call.agentId ?? call.agent?.agentId ?? null;
    const agentName = call.agent?.name ?? null;
    const durationSeconds = parseDurationSeconds(call.billedDuration);
    const clientName = getClientName(agentId, agentName);

    const { error: callError } = await supabase.from('ultravox_calls').upsert(
      {
        call_id: call.callId,
        agent_id: agentId,
        status: isEnded ? 'ended' : 'active',
        duration_seconds: durationSeconds,
        cost_usd: calcCostUsd(durationSeconds),
        ended_reason: call.endReason,
        client_name: clientName,
        created_at: call.created,
        ended_at: call.ended ?? null,
        raw_data: call,
      },
      { onConflict: 'call_id' }
    );

    if (callError) {
      console.error(`Error syncing call ${call.callId}:`, callError);
      continue;
    }
    console.log(`Synced call ${call.callId} (${clientName})`);

    if (isEnded) {
      try {
        const messages = await fetchCallMessages(call.callId);
        for (const msg of messages) {
          await supabase.from('ultravox_messages').upsert(
            {
              call_id: call.callId,
              role: msg.role,
              text: msg.text || '',
              ordinal: msg.callStageMessageIndex ?? 0,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'call_id,ordinal' }
          );
        }
        console.log(`  Synced ${messages.length} messages`);

        const tools = await fetchCallTools(call.callId);
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
        console.log(`  Synced ${tools.length} tool calls`);
      } catch (err) {
        console.error(`  Error fetching details for ${call.callId}:`, err);
      }
    }
  }

  console.log('Sync complete!');
}

syncCalls().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
