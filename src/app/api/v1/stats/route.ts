import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkApiKey } from '@/lib/api-auth';

export const revalidate = 60;

export async function GET(request: Request) {
  const denied = checkApiKey(request);
  if (denied) return denied;
  const [
    { count: totalCalls },
    { count: endedCount },
    { count: successfulCount },
    { count: activeCalls },
    { count: totalAnalyzed },
    { count: callsWithErrors },
    { data: aggregateRows },
  ] = await Promise.all([
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true })
      .eq('status', 'ended')
      .not('ended_reason', 'in', '(error,unjoined)'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('*', { count: 'exact', head: true })
      .gt('error_count', 0).eq('analysis_status', 'complete'),
    supabaseAdmin.from('ultravox_calls').select('cost_usd, duration_seconds').range(0, 9999),
  ]);

  const totalCost = aggregateRows?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
  const callsWithDuration = aggregateRows?.filter((c) => (c.duration_seconds || 0) > 0) || [];
  const avgDurationSeconds = callsWithDuration.length > 0
    ? Math.round(callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callsWithDuration.length)
    : 0;

  return NextResponse.json({
    total_calls: totalCalls ?? 0,
    ended_calls: endedCount ?? 0,
    active_calls: activeCalls ?? 0,
    success_rate_pct: (endedCount ?? 0) > 0
      ? Math.round(((successfulCount ?? 0) / (endedCount ?? 1)) * 100)
      : 0,
    total_cost_usd: Math.round(totalCost * 100) / 100,
    avg_duration_seconds: avgDurationSeconds,
    total_analyzed: totalAnalyzed ?? 0,
    calls_with_errors: callsWithErrors ?? 0,
    error_rate_pct: (totalAnalyzed ?? 0) > 0
      ? Math.round(((callsWithErrors ?? 0) / (totalAnalyzed ?? 1)) * 100)
      : 0,
  });
}
