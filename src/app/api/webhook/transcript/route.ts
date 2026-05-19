import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseExtractedToAnalysis } from '@/lib/audio-analyzer';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { status, call_id, raw_transcript, extracted_data, message } = body;

  if (!call_id) {
    return NextResponse.json({ error: 'call_id required' }, { status: 400 });
  }

  if (status === 'error') {
    await supabaseAdmin
      .from('ultravox_calls')
      .update({ analysis_status: 'error', transcript_status: 'error', transcript_error: message })
      .eq('call_id', call_id);
    return NextResponse.json({ received: true, status: 'error' });
  }

  const analysis = extracted_data ? parseExtractedToAnalysis(extracted_data) : null;

  await supabaseAdmin
    .from('ultravox_calls')
    .update({
      transcript_status: 'complete',
      raw_transcript,
      extracted_data,
      ...(analysis && {
        call_errors: analysis,
        analysis_status: 'complete',
        error_count: analysis.error_count,
        critical_error_count: analysis.critical_error_count,
      }),
    })
    .eq('call_id', call_id);

  return NextResponse.json({ received: true, status: 'success' });
}
