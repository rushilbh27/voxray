export default function AgentProfileLoading() {
  return (
    <div className="min-h-screen bg-canvas animate-pulse">
      <div className="h-14 bg-surface border-b border-border" />
      <main className="max-w-7xl mx-auto px-6 pb-16">
        {/* Header skeleton */}
        <div className="py-6 border-b border-border mb-8">
          <div className="h-3 w-24 bg-surface-2 rounded mb-4" />
          <div className="h-8 w-64 bg-surface-2 rounded mb-2" />
          <div className="h-3 w-96 bg-surface-2 rounded" />
        </div>

        {/* Stat strip skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl px-4 py-3">
              <div className="h-3 w-16 bg-surface-2 rounded mb-2" />
              <div className="h-7 w-12 bg-surface-2 rounded" />
            </div>
          ))}
        </div>

        {/* Error list skeleton */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border-subtle">
            <div className="h-3 w-40 bg-surface-2 rounded" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-border-subtle last:border-0">
              <div className="h-4 w-48 bg-surface-2 rounded mb-2" />
              <div className="h-3 w-32 bg-surface-2 rounded mb-3" />
              <div className="h-20 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
