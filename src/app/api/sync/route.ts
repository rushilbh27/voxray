import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  fetchCalls,
  fetchCallMessages,
  fetchCallTools,
  getClientName,
  calcCostUsd,
} from '@/lib/ultravox';

function parseDurationSeconds(d: string | null | undefined): number {
  if (!d) return 0;
  return parseFloat(d.replace('s', '')) || 0;
}

export async function POST() {
  try {
    const calls = await fetchCalls(100);
    let synced = 0;
    let msgTotal = 0;

    for (const call of calls) {
      const isEnded = !!call.ended;
      const agentId = call.agentId ?? call.agent?.agentId ?? null;
      const agentName = call.agent?.name ?? null;
      const durationSeconds = parseDurationSeconds(call.billedDuration);
      const systemPrompt = (call as Record<string, unknown>).systemPrompt as string | null;
      const clientName = getClientName(agentId, agentName, systemPrompt);

      const { error } = await supabaseAdmin.from('ultravox_calls').upsert(
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

      if (error) continue;
      synced++;

      if (isEnded) {
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
            await supabaseAdmin
              .from('ultravox_messages')
              .upsert(rows, { onConflict: 'call_id,ordinal' });
            msgTotal += messages.length;
          }

          const tools = await fetchCallTools(call.callId);
          for (const tool of tools) {
            await supabaseAdmin.from('ultravox_tools').upsert({
              call_id: call.callId,
              tool_name: tool.name,
              parameters: tool.parameters,
              result: tool.result,
              invocation_time: tool.invocationTime,
              status: tool.result ? 'success' : 'error',
              error_message: tool.errorMessage,
            });
          }
        } catch {
          // Skip failed message/tool fetches
        }
      }
    }

    return NextResponse.json({ synced, messages: msgTotal, total: calls.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
