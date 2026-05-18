import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

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

  const isSuccess =
    call.status === 'ended' && !call.ended_reason?.includes('error');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">
        {/* Back */}
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
                    isSuccess
                      ? 'bg-green-100 text-green-800'
                      : call.status === 'active'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {call.status}
                </span>
                <h1 className="text-xl font-bold text-gray-900">
                  {call.client_name}
                </h1>
              </div>
              <p className="text-xs text-gray-400 font-mono">{call.call_id}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div className="text-lg font-bold text-gray-800">{durationStr}</div>
              <div className="text-green-600 font-medium">
                ${(call.cost_usd || 0).toFixed(4)}
              </div>
            </div>
          </div>

          {/* Metadata grid */}
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

        {/* Transcript */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
            <span className="text-sm text-gray-400">
              {messages?.length || 0} messages
            </span>
          </div>

          {!messages || messages.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No transcript available for this call.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 px-6 py-4 space-y-4">
              {messages.map((msg) => {
                const isAgent =
                  msg.role?.includes('AGENT') || msg.role === 'agent';
                const isTool =
                  msg.role?.includes('TOOL') || msg.role?.includes('tool');
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 py-2 ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isTool
                          ? 'bg-yellow-100 text-yellow-700'
                          : isAgent
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {isTool ? '⚙' : isAgent ? 'A' : 'U'}
                    </div>
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        isTool
                          ? 'bg-yellow-50 text-yellow-800 font-mono text-xs'
                          : isAgent
                            ? 'bg-blue-50 text-gray-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {isTool && (
                        <div className="text-xs text-yellow-600 mb-1 font-sans">
                          Tool call
                        </div>
                      )}
                      {msg.text}
                    </div>
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
