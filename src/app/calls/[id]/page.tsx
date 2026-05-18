import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CallError, ErrorAnalysis } from '@/lib/error-analyzer';
import AnalyzeButton from './AnalyzeButton';

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border border-red-200',
  major: 'bg-orange-100 text-orange-800 border border-orange-200',
  minor: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;

  const [{ data: call }, { data: messages }] = await Promise.all([
    supabaseAdmin.from('ultravox_calls').select('*').eq('call_id', id).single(),
    supabaseAdmin
      .from('ultravox_messages')
      .select('*')
      .eq('call_id', id)
      .order('ordinal', { ascending: true }),
  ]);

  if (!call) notFound();

  const duration = call.duration_seconds || 0;
  const durationStr = `${Math.floor(duration / 60)}m ${duration % 60}s`;
  const isSuccess = call.status === 'ended' && !call.ended_reason?.includes('error');
  const isUnjoined = call.ended_reason === 'unjoined';

  const rawData = call.raw_data as Record<string, unknown> | null;
  const shortSummary = rawData?.shortSummary as string | null;

  // Error analysis
  const analysis = call.call_errors as ErrorAnalysis | null;
  const analysisStatus = call.analysis_status as string | null;
  const errors: CallError[] = analysis?.errors ?? [];

  // Build a set of message ordinals that have errors for inline annotation
  const errorsByOrdinal = new Map<number, CallError[]>();
  for (const err of errors) {
    const idx = err.timestamp_index ?? -1;
    if (idx >= 0) {
      if (!errorsByOrdinal.has(idx)) errorsByOrdinal.set(idx, []);
      errorsByOrdinal.get(idx)!.push(err);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-900 mb-6 inline-flex items-center gap-1"
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    isUnjoined
                      ? 'bg-gray-100 text-gray-500'
                      : isSuccess
                        ? 'bg-green-100 text-green-800'
                        : call.status === 'active'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                  }`}
                >
                  {call.status}
                </span>
                <h1 className="text-xl font-bold text-gray-900">{call.client_name}</h1>
              </div>
              <p className="text-xs text-gray-400 font-mono">{call.call_id}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800">{durationStr}</div>
              <div className="text-sm text-green-600 font-medium">
                ${(call.cost_usd || 0).toFixed(4)}
              </div>
            </div>
          </div>

          {shortSummary && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              {shortSummary}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-400 mb-1">Created</div>
              <div className="text-sm text-gray-700">
                {new Date(call.created_at).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Ended</div>
              <div className="text-sm text-gray-700">
                {call.ended_at ? new Date(call.ended_at).toLocaleString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">End Reason</div>
              <div className="text-sm text-gray-700">{call.ended_reason || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Agent ID</div>
              <div className="text-xs text-gray-500 font-mono truncate">
                {call.agent_id || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Error Analysis */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Error Analysis</h2>
              {analysisStatus === 'complete' && (
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  errors.length === 0
                    ? 'bg-green-100 text-green-700'
                    : call.critical_error_count > 0
                      ? 'bg-red-100 text-red-700'
                      : 'bg-orange-100 text-orange-700'
                }`}>
                  {errors.length === 0
                    ? '✓ Clean call'
                    : `${call.critical_error_count ?? 0} critical · ${errors.length} total`}
                </span>
              )}
              {analysisStatus === 'analyzing' && (
                <span className="text-xs text-blue-500">Analyzing...</span>
              )}
            </div>
            <AnalyzeButton callId={call.call_id} status={analysisStatus} />
          </div>

          {analysisStatus === 'complete' && analysis ? (
            <div className="p-6">
              {analysis.summary && (
                <p className="text-sm text-gray-600 mb-4">{analysis.summary}</p>
              )}

              {/* Goal outcome */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${analysis.goal_achieved ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-700">
                    Goal: <span className="font-medium">{analysis.goal_outcome || (analysis.goal_achieved ? 'achieved' : 'not achieved')}</span>
                  </span>
                </div>
              </div>

              {errors.length === 0 ? (
                <div className="text-sm text-green-600 font-medium">No errors detected — agent followed all rules correctly.</div>
              ) : (
                <div className="space-y-3">
                  {errors.map((err, i) => (
                    <div key={i} className={`rounded-lg p-4 ${SEVERITY_STYLES[err.severity] ?? 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wide opacity-70">
                          {err.severity}
                        </span>
                        <span className="text-xs font-mono bg-white bg-opacity-60 px-1.5 py-0.5 rounded">
                          {err.type}
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1">{err.what_went_wrong}</div>
                      {err.agent_line && (
                        <div className="text-xs font-mono bg-white bg-opacity-50 px-2 py-1.5 rounded mb-2 italic">
                          &ldquo;{err.agent_line}&rdquo;
                        </div>
                      )}
                      {err.should_have_said && (
                        <div className="text-xs text-current opacity-80">
                          <span className="font-semibold">Should have: </span>{err.should_have_said}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {analysis.missed_opportunities?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Missed Opportunities
                  </div>
                  <ul className="space-y-1">
                    {analysis.missed_opportunities.map((opp, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">→</span>
                        {opp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : analysisStatus === 'analyzing' ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              Analysis in progress...
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              {messages && messages.length > 0
                ? 'Click "Analyze" to run error detection on this call.'
                : 'No transcript available to analyze.'}
            </div>
          )}
        </div>

        {/* AI Analysis from LLM server */}
        {call.extracted_data && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Extracted Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(call.extracted_data as Record<string, string>).map(([key, value]) => (
                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-gray-800">{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Transcript
              {messages && messages.length > 0 && (
                <span className="text-xs text-gray-400 font-normal ml-2">via messages API</span>
              )}
            </h2>
            <span className="text-sm text-gray-400">{messages?.length || 0} messages</span>
          </div>

          {!messages || messages.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              {isUnjoined
                ? 'Call was not joined — no transcript.'
                : call.raw_transcript
                  ? 'No message-level transcript. See extracted data above.'
                  : 'No transcript available.'}
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {messages.map((msg, idx) => {
                const isAgent = msg.role?.includes('AGENT') || msg.role === 'agent';
                const isTool = msg.role?.includes('TOOL') || msg.role?.includes('tool');
                if (isTool && !msg.text) return null;
                const msgErrors = errorsByOrdinal.get(idx) ?? [];
                return (
                  <div key={msg.id}>
                    <div className={`flex gap-3 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${
                          isTool
                            ? 'bg-yellow-100 text-yellow-700'
                            : isAgent
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {isTool ? '⚙' : isAgent ? 'A' : 'U'}
                      </div>
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msgErrors.length > 0
                            ? msgErrors.some(e => e.severity === 'critical')
                              ? 'bg-red-50 text-gray-800 ring-1 ring-red-300'
                              : 'bg-orange-50 text-gray-800 ring-1 ring-orange-200'
                            : isTool
                              ? 'bg-yellow-50 text-yellow-800 font-mono text-xs'
                              : isAgent
                                ? 'bg-blue-50 text-gray-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {isTool && (
                          <div className="text-xs text-yellow-600 mb-1 font-sans">Tool call</div>
                        )}
                        {msg.text}
                      </div>
                    </div>
                    {/* Inline error annotations */}
                    {msgErrors.length > 0 && (
                      <div className={`ml-10 mt-1 space-y-1 ${isAgent ? '' : 'mr-10 ml-0'}`}>
                        {msgErrors.map((err, ei) => (
                          <div
                            key={ei}
                            className={`text-xs px-3 py-1.5 rounded-lg ${
                              err.severity === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : err.severity === 'major'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            <span className="font-mono font-semibold">[{err.type}]</span>{' '}
                            {err.what_went_wrong}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
