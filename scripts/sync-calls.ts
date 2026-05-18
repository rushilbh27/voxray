import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  fetchCalls,
  fetchCallMessages,
  fetchCallTools,
  getClientName,
  calcCostUsd,
} from '../src/lib/ultravox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncCalls() {
  console.log('Starting Ultravox call sync...');

  const calls = await fetchCalls(100);
  console.log(`Found ${calls.length} calls from Ultravox`);

  for (const call of calls) {
    const { error: callError } = await supabase.from('ultravox_calls').upsert(
      {
        call_id: call.id,
        agent_id: call.agentId,
        status: call.ended ? 'ended' : 'active',
        duration_seconds: call.durationSeconds || 0,
        cost_usd: calcCostUsd(call.durationSeconds || 0),
        ended_reason: call.endedReason,
        client_name: getClientName(call.agentId),
        created_at: call.created,
        ended_at: call.ended ? new Date().toISOString() : null,
        raw_data: call,
      },
      { onConflict: 'call_id' }
    );

    if (callError) {
      console.error(`Error syncing call ${call.id}:`, callError);
      continue;
    }
    console.log(`Synced call ${call.id} (${getClientName(call.agentId)})`);

    if (call.ended) {
      try {
        const messages = await fetchCallMessages(call.id);
        for (const msg of messages) {
          await supabase.from('ultravox_messages').upsert(
            {
              call_id: call.id,
              role: msg.role,
              text: msg.text,
              ordinal: msg.ordinal,
              created_at: msg.created,
            },
            { onConflict: 'call_id,ordinal' }
          );
        }
        console.log(`  Synced ${messages.length} messages`);

        const tools = await fetchCallTools(call.id);
        for (const tool of tools) {
          await supabase.from('ultravox_tools').upsert({
            call_id: call.id,
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
        console.error(`  Error fetching details for ${call.id}:`, err);
      }
    }
  }

  console.log('Sync complete!');
}

syncCalls().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
