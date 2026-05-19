import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ErrorAnalysis } from '@/lib/error-analyzer';
import { checkApiKey } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const denied = checkApiKey(_req);
  if (denied) return denied;
  const { id } = await ctx.params;

  const [{ data: call }, { data: messages }] = await Promise.all([
    supabaseAdmin
      .from('ultravox_calls')
      .select('*')
      .eq('call_id', id)
      .single(),
    supabaseAdmin
      .from('ultravox_messages')
      .select('role, text, ordinal')
      .eq('call_id', id)
      .order('ordinal', { ascending: true }),
  ]);

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const analysis = call.call_errors as ErrorAnalysis | null;

  return NextResponse.json({
    call_id: call.call_id,
    agent: call.client_name,
    status: call.status,
    ended_reason: call.ended_reason,
    duration_seconds: call.duration_seconds,
    cost_usd: call.cost_usd,
    created_at: call.created_at,
    ended_at: call.ended_at,
    analysis_status: call.analysis_status,
    error_count: call.error_count ?? 0,
    critical_error_count: call.critical_error_count ?? 0,
    analysis: analysis
      ? {
          goal_achieved: analysis.goal_achieved,
          goal_outcome: analysis.goal_outcome,
          summary: analysis.summary,
          missed_opportunities: analysis.missed_opportunities,
          errors: analysis.errors,
        }
      : null,
    transcript: (messages ?? []).map((m) => ({
      role: m.role.includes('AGENT') || m.role === 'agent' ? 'agent' : m.role.includes('TOOL') ? 'tool' : 'user',
      text: m.text,
      ordinal: m.ordinal,
    })),
  });
}
