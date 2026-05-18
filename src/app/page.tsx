import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 60;

export default async function Dashboard() {
  const { data: calls } = await supabaseAdmin
    .from('ultravox_calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  const totalCalls = calls?.length || 0;
  const successfulCalls =
    calls?.filter((c) => c.status === 'ended' && !c.ended_reason?.includes('error')).length || 0;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  const totalCost = calls?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
  const avgDuration =
    calls && calls.length > 0
      ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length)
      : 0;
  const activeCalls = calls?.filter((c) => c.status === 'active').length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voxray</h1>
          <p className="text-gray-500 mt-1">X-ray vision for your voice agents</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Calls', value: totalCalls, color: 'text-gray-900' },
            { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-600' },
            { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, color: 'text-gray-900' },
            {
              label: 'Avg Duration',
              value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`,
              color: 'text-gray-900',
            },
            { label: 'Active Now', value: activeCalls, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">{label}</div>
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {calls?.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-400">
                No calls yet. Run <code className="font-mono">npm run sync</code> to fetch data.
              </div>
            )}
            {calls?.map((call) => {
              const isSuccess = call.status === 'ended' && !call.ended_reason?.includes('error');
              const badgeClass = isSuccess
                ? 'bg-green-100 text-green-800'
                : call.status === 'active'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800';
              return (
                <Link
                  key={call.call_id}
                  href={`/calls/${call.call_id}`}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors block"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}>
                          {call.status}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {call.client_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{call.call_id}</div>
                      {call.ended_reason && (
                        <div className="mt-1 text-xs text-red-500">Ended: {call.ended_reason}</div>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500 shrink-0">
                      <div className="font-medium text-gray-700">
                        {Math.floor((call.duration_seconds || 0) / 60)}m{' '}
                        {(call.duration_seconds || 0) % 60}s
                      </div>
                      <div className="text-xs">${(call.cost_usd || 0).toFixed(3)}</div>
                      <div className="text-xs mt-1">
                        {new Date(call.created_at).toLocaleDateString()}{' '}
                        {new Date(call.created_at).toLocaleTimeString()}
                      </div>
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
