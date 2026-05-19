import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Receives enrichment data from self-hosted Llama server.
// ONLY stores: raw_transcript, customer_name, agent_name, goal_outcome.
// NEVER overwrites call_errors — Claude Haiku is authoritative for error analysis.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { status, call_id, raw_transcript, extracted_data, message } = body;

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 });
  }

  if (status === 'error') {
    await supabaseAdmin
      .from('ultravox_calls')
      .update({ transcript_status: 'error', transcript_error: message })
      .eq('call_id', call_id);
    return NextResponse.json({ received: true, status: 'error' });
  }

  const ext = extracted_data || {};
  await supabaseAdmin
    .from('ultravox_calls')
    .update({
      transcript_status: 'complete',
      raw_transcript: raw_transcript ?? null,
      extracted_data: extracted_data ?? null,
      // Enrichment fields — safe to set, never touches call_errors
      ...(ext.customer_name && { customer_name: ext.customer_name }),
      ...(ext.agent_name    && { agent_voice_name: ext.agent_name }),
    })
    .eq('call_id', call_id);

  return NextResponse.json({ received: true, status: 'success' });
}
