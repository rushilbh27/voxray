import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  fetchCalls,
  fetchCallMessages,
  fetchCallTools,
  getClientName,
  calcCostUsd,
} from '@/lib/ultravox';
import { analyzeCallErrors, detectAgentType } from '@/lib/error-analyzer';

function parseDurationSeconds(d: string | null | undefined): number {
  if (!d) return 0;
  return parseFloat(d.replace('s', '')) || 0;
}

export async function POST() {
  try {
    const calls = await fetchCalls(100);
    let synced = 0;
    let msgTotal = 0;
    let analyzed = 0;

    // Track which call_ids already have analysis so we don't re-analyze
    const callIds = calls.map((c) => c.callId);
    const { data: existingAnalysis } = await supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, analysis_status')
      .in('call_id', callIds);
    const analyzedSet = new Set(
      (existingAnalysis ?? [])
        .filter((r) => r.analysis_status === 'complete')
        .map((r) => r.call_id)
    );

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
        let savedMessages: Array<{ role: string; text: string; ordinal: number }> = [];
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
            savedMessages = rows;
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

        // Auto-analyze new calls with enough messages
        if (savedMessages.length >= 3 && !analyzedSet.has(call.callId)) {
          try {
            await supabaseAdmin
              .from('ultravox_calls')
              .update({ analysis_status: 'analyzing' })
              .eq('call_id', call.callId);

            const agentType = detectAgentType(clientName);
            const analysis = await analyzeCallErrors(savedMessages, agentType);

            await supabaseAdmin
              .from('ultravox_calls')
              .update({
                call_errors: analysis,
                analysis_status: 'complete',
                error_count: analysis.error_count,
                critical_error_count: analysis.critical_error_count,
              })
              .eq('call_id', call.callId);

            analyzed++;
          } catch {
            await supabaseAdmin
              .from('ultravox_calls')
              .update({ analysis_status: 'error' })
              .eq('call_id', call.callId);
          }
        }
      }
    }

    return NextResponse.json({ synced, messages: msgTotal, analyzed, total: calls.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
