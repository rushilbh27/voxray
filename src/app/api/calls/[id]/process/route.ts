import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api';
const LLM_SERVER = 'http://72.61.206.216:8000/process-call';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Trigger transcript processing: fetch recording → send to LLM server → webhook delivers result
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: callId } = await ctx.params;

  // Get call from DB for context
  const { data: call } = await supabaseAdmin
    .from('ultravox_calls')
    .select('*')
    .eq('call_id', callId)
    .single();

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  }

  // Mark as processing
  await supabaseAdmin
    .from('ultravox_calls')
    .update({ transcript_status: 'processing' })
    .eq('call_id', callId);

  try {
    // Step 1: Fetch recording from Ultravox
    const recordingRes = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/recording`, {
      headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
    });

    if (!recordingRes.ok) {
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ transcript_status: 'error', transcript_error: `Recording fetch failed: ${recordingRes.status}` })
        .eq('call_id', callId);
      return NextResponse.json({ error: `Recording not available: ${recordingRes.status}` }, { status: 404 });
    }

    const audioBlob = await recordingRes.blob();

    // Step 2: Build webhook URL (this app's webhook endpoint)
    const webhookUrl = `${req.nextUrl.origin}/api/webhook/transcript`;

    // Step 3: Send to LLM server
    const form = new FormData();
    form.append('file', audioBlob, `${callId}.wav`);
    form.append('webhook_url', webhookUrl);
    form.append('uid', call.client_name || 'unknown');
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

    return NextResponse.json({ status: 'queued', llm_response: llmData });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await supabaseAdmin
      .from('ultravox_calls')
      .update({ transcript_status: 'error', transcript_error: msg })
      .eq('call_id', callId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
