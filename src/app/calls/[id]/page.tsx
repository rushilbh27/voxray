import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CallError, ErrorAnalysis } from '@/lib/error-analyzer';
import AnalyzeButton from './AnalyzeButton';
import { Nav } from '@/app/components/Nav';

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: Props) {
  const { id } = await params;

  const [{ data: call }, { data: messages }] = await Promise.all([
    supabaseAdmin.from('ultravox_calls').select('*').eq('call_id', id).single(),
    supabaseAdmin.from('ultravox_messages').select('*').eq('call_id', id).order('ordinal' as never, { ascending: true }),
  ]);

  if (!call) notFound();

  const duration = call.duration_seconds || 0;
  const durationStr = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
  const isUnjoined = call.ended_reason === 'unjoined';
  const isError = call.ended_reason?.includes('error');
  const rawData = call.raw_data as Record<string, unknown> | null;
  const shortSummary = rawData?.shortSummary as string | null;
  const analysis = call.call_errors as ErrorAnalysis | null;
  const analysisStatus = call.analysis_status as string | null;
  const errors: CallError[] = analysis?.errors ?? [];

  const errorsByOrdinal = new Map<number, CallError[]>();
  for (const err of errors) {
    const idx = err.timestamp_index ?? -1;
    if (idx >= 0) {
      if (!errorsByOrdinal.has(idx)) errorsByOrdinal.set(idx, []);
      errorsByOrdinal.get(idx)!.push(err);
    }
  }

  const statusColor = isUnjoined
    ? 'bg-surface-2 text-ink-3 border-border'
    : isError
      ? 'bg-crit-bg text-crit border-crit-border'
      : call.status === 'active'
        ? 'bg-accent-bg text-accent border-accent-border'
        : 'bg-ok-bg text-ok border-ok-border';

  return (
    <div className="min-h-screen bg-canvas">
      <Nav />

      <main className="max-w-6xl mx-auto px-6 pb-16">
        {/* Breadcrumb */}
        <div className="py-4 mb-2">
          <Link href="/" className="text-xs text-ink-3 hover:text-accent transition-colors">
            ← Dashboard
          </Link>
        </div>

        {/* ── CALL HEADER ──────────────────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`inline-block px-2 py-0.5 text-[11px] font-medium border rounded-md ${statusColor}`}>
                  {call.status}
                </span>
                <h1 className="text-lg font-semibold text-ink truncate">{call.client_name}</h1>
              </div>
              <div className="text-xs font-mono text-ink-3">{call.call_id}</div>
              {shortSummary && (
                <div className="mt-3 text-sm text-ink-2 leading-relaxed">{shortSummary}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-bold text-ink tabular-nums">{durationStr}</div>
              <div className="text-sm text-ink-3">${(call.cost_usd || 0).toFixed(4)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
            {[
              { label: 'Created', value: new Date(call.created_at).toLocaleString() },
              { label: 'Ended', value: call.ended_at ? new Date(call.ended_at).toLocaleString() : '—' },
              { label: 'End Reason', value: call.ended_reason || '—' },
              { label: 'Agent ID', value: call.agent_id || '—', mono: true },
            ].map(({ label, value, mono }) => (
              <div key={label}>
                <div className="text-[11px] text-ink-3 uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-sm text-ink-2 truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[5fr_4fr] gap-5">

          {/* ── TRANSCRIPT ───────────────────────────────────────────────────────── */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Transcript</span>
              <span className="text-xs text-ink-3">{messages?.length || 0} messages</span>
            </div>

            {!messages || messages.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-sm text-ink-2 font-medium mb-1">
                  {isUnjoined ? 'Call not joined' : 'No transcript'}
                </div>
                <div className="text-xs text-ink-3">
                  {isUnjoined ? 'Call ended before anyone connected.' : 'No message-level data available.'}
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
                {messages.map((msg, idx) => {
                  const isAgent = msg.role?.includes('AGENT') || msg.role === 'agent';
                  const isTool = msg.role?.includes('TOOL') || msg.role?.includes('tool');
                  if (isTool && !msg.text) return null;
                  const msgErrors = errorsByOrdinal.get(idx) ?? [];
                  const hasCrit = msgErrors.some(e => e.severity === 'critical');
                  const hasErr = msgErrors.length > 0;

                  return (
                    <div key={msg.id}>
                      <div className={`flex gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                          isTool ? 'bg-warn-bg text-warn border border-warn-border'
                            : isAgent ? 'bg-accent-bg text-accent border border-accent-border'
                            : 'bg-surface-2 text-ink-2 border border-border'
                        }`}>
                          {isTool ? '⚙' : isAgent ? 'A' : 'U'}
                        </div>
                        <div className={`max-w-[78%] px-3.5 py-2 rounded-xl text-sm leading-relaxed ${
                          hasCrit ? 'bg-crit-bg text-ink border border-crit-border'
                            : hasErr ? 'bg-warn-bg text-ink border border-warn-border'
                            : isTool ? 'bg-warn-bg text-warn-700 font-mono text-xs border border-warn-border'
                            : isAgent ? 'bg-accent-bg text-ink border border-accent-border'
                            : 'bg-surface-2 text-ink border border-border'
                        }`}>
                          {isTool && <div className="text-[10px] text-warn mb-1 uppercase tracking-wide font-sans font-semibold">Tool</div>}
                          {msg.text}
                        </div>
                      </div>
                      {msgErrors.length > 0 && (
                        <div className={`mt-1 space-y-1 ${isAgent ? 'ml-[34px]' : 'mr-[34px]'}`}>
                          {msgErrors.map((err, ei) => (
                            <div key={ei} className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${
                              err.severity === 'critical' ? 'bg-crit-bg text-crit border-crit-border'
                                : err.severity === 'major' ? 'bg-warn-bg text-warn border-warn-border'
                                : 'bg-surface-2 text-ink-2 border-border'
                            }`}>
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

          {/* ── RIGHT COLUMN ──────────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Error Analysis */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Error Analysis</span>
                  {analysisStatus === 'complete' && (
                    <span className={`px-2 py-0.5 text-[11px] font-medium border rounded-md ${
                      errors.length === 0 ? 'bg-ok-bg text-ok border-ok-border'
                        : (call.critical_error_count ?? 0) > 0 ? 'bg-crit-bg text-crit border-crit-border'
                        : 'bg-warn-bg text-warn border-warn-border'
                    }`}>
                      {errors.length === 0 ? '✓ Clean' : `${call.critical_error_count ?? 0}c · ${errors.length} errors`}
                    </span>
                  )}
                  {analysisStatus === 'analyzing' && (
                    <span className="text-xs text-accent">Analyzing…</span>
                  )}
                </div>
                <AnalyzeButton callId={call.call_id} status={analysisStatus} />
              </div>

              {analysisStatus === 'complete' && analysis ? (
                <div className="p-5">
                  {analysis.summary && (
                    <p className="text-sm text-ink-2 mb-4 leading-relaxed">{analysis.summary}</p>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${analysis.goal_achieved ? 'bg-ok' : 'bg-crit'}`} />
                    <span className="text-sm text-ink-2">
                      Goal: <span className="font-medium text-ink">{analysis.goal_outcome || (analysis.goal_achieved ? 'achieved' : 'not achieved')}</span>
                    </span>
                  </div>

                  {errors.length === 0 ? (
                    <div className="text-sm text-ok font-medium">No errors — agent followed all rules correctly.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {errors.map((err, i) => (
                        <div key={i} className={`rounded-lg p-3.5 border text-sm ${
                          err.severity === 'critical' ? 'bg-crit-bg border-crit-border'
                            : err.severity === 'major' ? 'bg-warn-bg border-warn-border'
                            : 'bg-surface-2 border-border'
                        }`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${
                              err.severity === 'critical' ? 'text-crit'
                                : err.severity === 'major' ? 'text-warn'
                                : 'text-ink-3'
                            }`}>{err.severity}</span>
                            <span className="text-[11px] font-mono text-ink-3 bg-surface px-1.5 py-0.5 rounded border border-border">{err.type}</span>
                          </div>
                          <div className="text-sm font-medium text-ink mb-1.5">{err.what_went_wrong}</div>
                          {err.agent_line && (
                            <div className="text-xs font-mono text-ink-2 bg-surface px-2.5 py-1.5 rounded-lg border border-border mb-1.5 italic">
                              &ldquo;{err.agent_line}&rdquo;
                            </div>
                          )}
                          {err.should_have_said && (
                            <div className="text-xs text-ink-2">
                              <span className="font-semibold text-ink">Should have: </span>{err.should_have_said}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {(analysis.missed_opportunities?.length ?? 0) > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Coaching Notes</div>
                      <ul className="space-y-1.5">
                        {analysis.missed_opportunities.map((opp, i) => (
                          <li key={i} className="text-xs text-ink-2 flex items-start gap-2">
                            <span className="text-ink-3 mt-0.5 shrink-0">→</span>
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : analysisStatus === 'analyzing' ? (
                <div className="px-5 py-8 text-center text-sm text-ink-3">Analysis in progress…</div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <div className="text-sm text-ink-2 mb-1">
                    {messages && messages.length > 0 ? 'Not yet analyzed' : 'No transcript'}
                  </div>
                  <div className="text-xs text-ink-3">
                    {messages && messages.length > 0 ? 'Click Analyze to run error detection.' : 'Cannot analyze without a transcript.'}
                  </div>
                </div>
              )}
            </div>

            {/* Call metadata */}
            {call.extracted_data && (
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border-subtle">
                  <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Enrichment</span>
                </div>
                <div className="p-5 grid grid-cols-2 gap-3">
                  {Object.entries(call.extracted_data as Record<string, string>)
                    .filter(([, v]) => v)
                    .map(([key, value]) => (
                      <div key={key}>
                        <div className="text-[11px] text-ink-3 uppercase tracking-wider mb-0.5">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-ink truncate">{value}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
