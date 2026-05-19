import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { ErrorAnalysis } from '@/lib/error-analyzer';

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const agent = searchParams.get('agent') ?? '';
  const hasErrors = searchParams.get('has_errors') === 'true';
  const analysisStatus = searchParams.get('analysis_status') ?? '';
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('ultravox_calls')
    .select(
      'call_id, client_name, status, ended_reason, duration_seconds, cost_usd, error_count, critical_error_count, analysis_status, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (agent) query = query.eq('client_name', agent);
  if (hasErrors) query = query.gt('error_count', 0);
  if (analysisStatus) query = query.eq('analysis_status', analysisStatus);

  const { data: calls, count } = await query;

  return NextResponse.json({
    calls: (calls ?? []).map((c) => ({
      call_id: c.call_id,
      agent: c.client_name,
      status: c.status,
      ended_reason: c.ended_reason,
      duration_seconds: c.duration_seconds,
      cost_usd: c.cost_usd,
      error_count: c.error_count ?? 0,
      critical_error_count: c.critical_error_count ?? 0,
      analysis_status: c.analysis_status,
      created_at: c.created_at,
    })),
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
