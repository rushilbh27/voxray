import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkApiKey } from '@/lib/api-auth';
import type { ErrorAnalysis } from '@/lib/error-analyzer';

export const revalidate = 0;

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

export async function GET(request: Request) {
  const denied = checkApiKey(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') ?? 'errors'; // errors | calls | worst_calls

  let csv = '';
  let filename = 'voxray-export.csv';

  if (type === 'errors') {
    const { data: errorCalls } = await supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at')
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .range(0, 9999);

    const freqMap = new Map<string, {
      error_type: string; occurrences: number; critical: number; agents: string; example_call_id: string;
    }>();
    for (const call of errorCalls ?? []) {
      const errors = (call.call_errors as ErrorAnalysis | null)?.errors ?? [];
      for (const e of errors) {
        if (!freqMap.has(e.type)) {
          freqMap.set(e.type, { error_type: e.type, occurrences: 0, critical: 0, agents: call.client_name as string, example_call_id: call.call_id as string });
        }
        const f = freqMap.get(e.type)!;
        f.occurrences++;
        if (e.severity === 'critical') f.critical++;
        if (!f.agents.includes(call.client_name as string)) f.agents += `, ${call.client_name}`;
      }
    }
    const rows = Array.from(freqMap.values()).sort((a, b) => b.occurrences - a.occurrences);
    csv = toCSV(rows as unknown as Record<string, unknown>[]);
    filename = 'voxray-errors.csv';

  } else if (type === 'worst_calls') {
    const { data: calls } = await supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, error_count, critical_error_count, call_errors, created_at, duration_seconds')
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .order('critical_error_count', { ascending: false })
      .limit(100);

    const rows = (calls ?? []).map((c) => ({
      call_id: c.call_id,
      agent: c.client_name,
      error_count: c.error_count,
      critical_error_count: c.critical_error_count,
      duration_seconds: c.duration_seconds,
      created_at: c.created_at,
      summary: (c.call_errors as ErrorAnalysis | null)?.summary ?? '',
      goal_achieved: (c.call_errors as ErrorAnalysis | null)?.goal_achieved ?? '',
    }));
    csv = toCSV(rows as Record<string, unknown>[]);
    filename = 'voxray-worst-calls.csv';

  } else {
    // type=calls — full call list
    const agent = searchParams.get('agent') ?? '';
    let q = supabaseAdmin
      .from('ultravox_calls')
      .select('call_id, client_name, status, ended_reason, duration_seconds, cost_usd, error_count, critical_error_count, analysis_status, created_at')
      .order('created_at', { ascending: false })
      .range(0, 4999);
    if (agent) q = q.eq('client_name', agent);
    const { data: calls } = await q;
    csv = toCSV((calls ?? []).map((c) => ({
      call_id: c.call_id,
      agent: c.client_name,
      status: c.status,
      ended_reason: c.ended_reason ?? '',
      duration_seconds: c.duration_seconds ?? 0,
      cost_usd: c.cost_usd ?? 0,
      error_count: c.error_count ?? 0,
      critical_error_count: c.critical_error_count ?? 0,
      analysis_status: c.analysis_status ?? '',
      created_at: c.created_at,
    })) as Record<string, unknown>[]);
    filename = 'voxray-calls.csv';
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
