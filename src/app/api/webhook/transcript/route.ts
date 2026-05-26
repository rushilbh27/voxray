import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Receives enrichment + fallback error analysis from self-hosted Llama server.
//
// When Haiku is UP:   only enrichment saved (transcript, names). call_errors untouched.
// When Haiku is DOWN: analysis_status = 'llama_pending' — Llama errors saved as call_errors.
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

  // Check if Haiku failed — if so, use Llama's error analysis as fallback
  const { data: callRow } = await supabaseAdmin
    .from('ultravox_calls')
    .select('analysis_status')
    .eq('call_id', call_id)
    .single();

  const needsFallback = callRow?.analysis_status === 'llama_pending'
    || callRow?.analysis_status === 'error'
    || callRow?.analysis_status === 'pending';

  let llamaErrorFields: Record<string, unknown> = {};
  if (needsFallback && extracted_data) {
    const { parseExtractedToAnalysis } = await import('@/lib/audio-analyzer');
    const analysis = parseExtractedToAnalysis(ext as Record<string, unknown>);
    llamaErrorFields = {
      call_errors:          analysis,
      analysis_status:      'complete',
      error_count:          analysis.error_count,
      critical_error_count: analysis.critical_error_count,
    };
    console.log(`[webhook/transcript] Llama fallback used for ${call_id} — ${analysis.error_count} errors found`);
  }

  await supabaseAdmin
    .from('ultravox_calls')
    .update({
      transcript_status: 'complete',
      raw_transcript: raw_transcript ?? null,
      extracted_data: extracted_data ?? null,
      // Enrichment fields — always safe to set
      ...(ext.customer_name && { customer_name: ext.customer_name }),
      ...(ext.agent_name    && { agent_voice_name: ext.agent_name }),
      // Fallback error analysis — only when Haiku unavailable
      ...llamaErrorFields,
    })
    .eq('call_id', call_id);

  return NextResponse.json({ received: true, status: 'success', llama_fallback: needsFallback });
}
