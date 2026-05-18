import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 60;

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  client?: string;
  status?: string;
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tokenCookie = cookies().get('voxray_access_token');
  if (!tokenCookie) {
    redirect('/login');
  }
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const clientFilter = params.client ?? '';
  const statusFilter = params.status ?? '';
  const offset = (page - 1) * PAGE_SIZE;

  // Total metrics (unfiltered)
  const { data: allCalls } = await supabaseAdmin
    .from('ultravox_calls')
    .select('status, duration_seconds, cost_usd, ended_reason');

  const totalCalls = allCalls?.length || 0;
  const endedCalls = allCalls?.filter((c) => c.status === 'ended') || [];
  const successfulCalls = endedCalls.filter(
    (c) => c.ended_reason !== 'error' && c.ended_reason !== 'unjoined'
  ).length;
  const successRate =
    endedCalls.length > 0 ? Math.round((successfulCalls / endedCalls.length) * 100) : 0;
  const totalCost = allCalls?.reduce((sum, c) => sum + (c.cost_usd || 0), 0) || 0;
  const callsWithDuration = allCalls?.filter((c) => (c.duration_seconds || 0) > 0) || [];
  const avgDuration =
    callsWithDuration.length > 0
      ? Math.round(
          callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
            callsWithDuration.length
        )
      : 0;
  const activeCalls = allCalls?.filter((c) => c.status === 'active').length || 0;

  // Client breakdown
  const { data: clientBreakdown } = await supabaseAdmin
    .from('ultravox_calls')
    .select('client_name');
  const clientCounts: Record<string, number> = {};
  for (const c of clientBreakdown || []) {
    clientCounts[c.client_name] = (clientCounts[c.client_name] || 0) + 1;
  }
  const clients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);

  // Filtered + paginated calls
  let query = supabaseAdmin
    .from('ultravox_calls')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (clientFilter) query = query.eq('client_name', clientFilter);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data: calls, count: filteredTotal } = await query;
  const totalPages = Math.ceil((filteredTotal || 0) / PAGE_SIZE);

  function buildUrl(overrides: Record<string, string>) {
    const p = { page: String(page), client: clientFilter, status: statusFilter, ...overrides };
    const qs = Object.entries(p)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return qs ? `/?${qs}` : '/';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voxray</h1>
          <p className="text-gray-500 mt-1">X-ray vision for your voice agents</p>
          <div className="flex gap-4 mt-2">
            <Link href="/errors" className="text-sm text-red-600 hover:text-red-800 font-medium">
              Error Intelligence →
            </Link>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total Calls', value: totalCalls.toLocaleString(), color: 'text-gray-900' },
            { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-600' },
            { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, color: 'text-gray-900' },
            {
              label: 'Avg Duration',
              value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s`,
              color: 'text-gray-900',
            },
            { label: 'Active Now', value: activeCalls, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg shadow p-5">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Client filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Link
            href={buildUrl({ client: '', page: '1' })}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              !clientFilter
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            All ({totalCalls})
          </Link>
          {clients.map(([name, count]) => (
            <Link
              key={name}
              href={buildUrl({ client: name, page: '1' })}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                clientFilter === name
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {name} ({count})
            </Link>
          ))}
        </div>

        {/* Call list */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {clientFilter || 'All'} Calls
            </h2>
            <span className="text-sm text-gray-400">
              {filteredTotal?.toLocaleString()} total · page {page} of {totalPages || 1}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {calls?.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                No calls found. Run <code className="font-mono">npm run sync</code> to fetch data.
              </div>
            )}
            {calls?.map((call) => {
              const isUnjoined = call.ended_reason === 'unjoined';
              const isError = call.ended_reason?.includes('error');
              const badgeClass = isUnjoined
                ? 'bg-gray-100 text-gray-500'
                : isError
                  ? 'bg-red-100 text-red-800'
                  : call.status === 'active'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800';
              const dur = call.duration_seconds || 0;
              return (
                <Link
                  key={call.call_id}
                  href={`/calls/${call.call_id}`}
                  className="px-6 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}
                      >
                        {call.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {call.client_name}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono truncate">{call.call_id}</div>
                    {call.ended_reason && (
                      <div className="mt-0.5 text-xs text-gray-500">
                        Ended: {call.ended_reason}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
                    <div className="font-medium text-gray-700">
                      {Math.floor(dur / 60)}m {dur % 60}s
                    </div>
                    <div className="text-xs">${(call.cost_usd || 0).toFixed(3)}</div>
                    <div className="text-xs mt-0.5 text-gray-400">
                      {new Date(call.created_at).toLocaleDateString()}{' '}
                      {new Date(call.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <Link
                href={buildUrl({ page: String(Math.max(1, page - 1)) })}
                className={`px-4 py-2 text-sm rounded-md border ${
                  page <= 1
                    ? 'text-gray-300 border-gray-200 pointer-events-none'
                    : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                ← Previous
              </Link>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) {
                    p = i + 1;
                  } else if (page <= 4) {
                    p = i + 1;
                  } else if (page >= totalPages - 3) {
                    p = totalPages - 6 + i;
                  } else {
                    p = page - 3 + i;
                  }
                  return (
                    <Link
                      key={p}
                      href={buildUrl({ page: String(p) })}
                      className={`w-8 h-8 flex items-center justify-center text-sm rounded-md ${
                        p === page
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </Link>
                  );
                })}
              </div>
              <Link
                href={buildUrl({ page: String(Math.min(totalPages, page + 1)) })}
                className={`px-4 py-2 text-sm rounded-md border ${
                  page >= totalPages
                    ? 'text-gray-300 border-gray-200 pointer-events-none'
                    : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Next →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
