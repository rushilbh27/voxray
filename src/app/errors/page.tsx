import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import type { ErrorAnalysis, CallError } from '@/lib/error-analyzer';

export const revalidate = 60;

interface ErrorFrequency {
  type: string;
  count: number;
  critical_count: number;
  example_call: string;
  example_line: string;
  agents: string[];
}

export default async function ErrorsPage() {
  const { data: calls } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at, duration_seconds')
    .eq('analysis_status', 'complete')
    .gt('error_count', 0)
    .order('created_at', { ascending: false });

  const { data: allAnalyzed } = await supabaseAdmin
    .from('ultravox_calls')
    .select('analysis_status', { count: 'exact' })
    .eq('analysis_status', 'complete');

  const totalAnalyzed = allAnalyzed?.length ?? 0;
  const callsWithErrors = calls?.length ?? 0;

  // Build error frequency table
  const freqMap = new Map<string, ErrorFrequency>();

  for (const call of calls ?? []) {
    const analysis = call.call_errors as ErrorAnalysis | null;
    if (!analysis?.errors) continue;

    for (const err of analysis.errors) {
      if (!freqMap.has(err.type)) {
        freqMap.set(err.type, {
          type: err.type,
          count: 0,
          critical_count: 0,
          example_call: call.call_id,
          example_line: err.agent_line ?? '',
          agents: [],
        });
      }
      const freq = freqMap.get(err.type)!;
      freq.count++;
      if (err.severity === 'critical') freq.critical_count++;
      if (!freq.agents.includes(call.client_name)) {
        freq.agents.push(call.client_name);
      }
    }
  }

  const topErrors = Array.from(freqMap.values())
    .sort((a, b) => b.count - a.count);

  // Most broken calls (most total errors)
  const worstCalls = [...(calls ?? [])]
    .sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Error Intelligence</h1>
            <p className="text-gray-500 mt-1">Pinpoint what the agent gets wrong — call by call</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div className="text-2xl font-bold text-gray-900">{totalAnalyzed}</div>
            <div>calls analyzed</div>
            <div className="mt-1 text-orange-600 font-medium">{callsWithErrors} with errors</div>
          </div>
        </div>

        {/* Error frequency leaderboard */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Most Common Errors</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ranked by frequency across all analyzed calls</p>
          </div>
          {topErrors.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No errors detected yet. Run <code className="font-mono">npm run analyze</code> to start.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {topErrors.map((err, i) => (
                <div key={err.type} className="px-6 py-4 flex items-start gap-4">
                  <div className="w-6 text-lg font-bold text-gray-300 shrink-0 pt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {err.type}
                      </span>
                      {err.critical_count > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          {err.critical_count} critical
                        </span>
                      )}
                    </div>
                    {err.example_line && (
                      <div className="text-xs text-gray-500 font-mono truncate mb-1">
                        e.g. &ldquo;{err.example_line.substring(0, 100)}&rdquo;
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Agents affected: {err.agents.slice(0, 4).join(', ')}
                      {err.agents.length > 4 && ` +${err.agents.length - 4} more`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-800">{err.count}</div>
                    <div className="text-xs text-gray-400">occurrences</div>
                    <Link
                      href={`/calls/${err.example_call}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      see example →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Worst calls */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Most Problematic Calls</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {worstCalls.map(call => {
              const analysis = call.call_errors as ErrorAnalysis | null;
              return (
                <Link
                  key={call.call_id}
                  href={`/calls/${call.call_id}`}
                  className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">{call.client_name}</span>
                      {(call.critical_error_count ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          {call.critical_error_count} critical
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{call.call_id.substring(0, 16)}...</div>
                    {analysis?.summary && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                        {analysis.summary}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-xl font-bold text-orange-600">{call.error_count}</div>
                    <div className="text-xs text-gray-400">errors</div>
                    <div className="text-xs text-gray-400">
                      {new Date(call.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
