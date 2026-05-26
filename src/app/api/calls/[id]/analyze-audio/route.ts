import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeCall } from '@/lib/call-analyzer';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: callId } = await ctx.params;

  const { data: call } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status')
    .eq('call_id', callId)
    .single();

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const force = (await req.json().catch(() => ({}))).force === true;
  if (call.analysis_status === 'complete' && !force) {
    return NextResponse.json({ status: 'already_analyzed' });
  }

  await supabaseAdmin
    .from('ultravox_calls')
    .update({ analysis_status: 'analyzing' })
    .eq('call_id', callId);

  const webhookUrl = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

  try {
    const { data: messages } = await supabaseAdmin
      .from('ultravox_messages')
      .select('role, text, ordinal')
      .eq('call_id', callId)
      .order('ordinal', { ascending: true });

    const result = await analyzeCall({
      callId,
      agentId: call.agent_id ?? null,
      clientName: call.client_name ?? '',
      messages: messages ?? [],
      webhookUrl,
    });

    await supabaseAdmin
      .from('ultravox_calls')
      .update({
        call_errors:          result.analysis,
        analysis_status:      result.haiku_failed ? 'llama_pending' : 'complete',
        error_count:          result.analysis.error_count,
        critical_error_count: result.analysis.critical_error_count,
      })
      .eq('call_id', callId);

    return NextResponse.json({ status: result.haiku_failed ? 'llama_pending' : 'complete' });
  } catch (err) {
    await supabaseAdmin
      .from('ultravox_calls')
      .update({ analysis_status: 'error' })
      .eq('call_id', callId);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
