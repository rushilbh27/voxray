import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Receives processed transcript from the LLM server (72.61.206.216:8000)
// Payload: { status, uid, call_id, raw_transcript, extracted_data } or { status: "error", ... }
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

  await supabaseAdmin
    .from('ultravox_calls')
    .update({
      transcript_status: 'complete',
      raw_transcript: raw_transcript,
      extracted_data: extracted_data,
    })
    .eq('call_id', call_id);

  return NextResponse.json({ received: true, status: 'success' });
}
