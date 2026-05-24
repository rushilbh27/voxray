export default function AgentProfileLoading() {
  return (
    <div className="min-h-screen bg-canvas animate-pulse">
      {/* Nav */}
      <div className="h-14 bg-surface border-b border-border" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">

        {/* Breadcrumb + header */}
        <div className="py-6 border-b border-border mb-8">
          <div className="h-3 w-24 bg-surface-2 rounded mb-4" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="h-8 w-56 bg-surface-2 rounded mb-2" />
              <div className="h-3 w-72 bg-surface-2 rounded" />
            </div>
            <div className="flex gap-2.5 shrink-0">
              <div className="h-8 w-28 bg-surface-2 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl px-4 py-3">
              <div className="h-2.5 w-16 bg-surface-2 rounded mb-2.5" />
              <div className="h-7 w-10 bg-surface-2 rounded" />
            </div>
          ))}
        </div>

        {/* Error Intelligence section label */}
        <div className="h-2.5 w-32 bg-surface-2 rounded mb-3" />
        <div className="h-6 w-48 bg-surface-2 rounded mb-5" />

        {/* Error leaderboard + worst calls side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 mb-10">
          {/* Error leaderboard */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle">
              <div className="h-3 w-40 bg-surface-2 rounded" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 border-b border-border-subtle last:border-0">
                <div className="flex gap-3">
                  <div className="h-4 w-4 bg-surface-2 rounded shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="h-4 w-48 bg-surface-2 rounded mb-2" />
                    <div className="h-2.5 w-32 bg-surface-2 rounded mb-3" />
                    {/* Patch block */}
                    <div className="h-16 bg-surface-2 rounded-lg mb-2" />
                    <div className="h-10 bg-surface-2 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Worst calls */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle">
              <div className="h-3 w-44 bg-surface-2 rounded" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 border-b border-border-subtle last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="h-3 w-40 bg-surface-2 rounded mb-2" />
                    <div className="h-2.5 w-28 bg-surface-2 rounded mb-2" />
                    <div className="flex gap-1.5 flex-wrap">
                      <div className="h-5 w-16 bg-surface-2 rounded-full" />
                      <div className="h-5 w-20 bg-surface-2 rounded-full" />
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="h-6 w-6 bg-surface-2 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap section */}
        <div className="h-2.5 w-48 bg-surface-2 rounded mb-3" />
        <div className="bg-surface border border-border rounded-xl p-5 mb-10">
          <div className="h-4 w-56 bg-surface-2 rounded mb-1.5" />
          <div className="h-3 w-80 bg-surface-2 rounded mb-5" />
          {/* Heatmap rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center">
              <div className="h-3 w-32 bg-surface-2 rounded shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 30 }).map((_, j) => (
                  <div key={j} className="h-4 w-4 bg-surface-2 rounded-sm" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Outcome chart section */}
        <div className="h-2.5 w-44 bg-surface-2 rounded mb-3" />
        <div className="bg-surface border border-border rounded-xl p-5 mb-10">
          <div className="h-4 w-64 bg-surface-2 rounded mb-1.5" />
          <div className="h-3 w-72 bg-surface-2 rounded mb-5" />
          {/* Stacked bar chart skeleton */}
          <div className="flex items-end gap-2 h-36">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col-reverse gap-0.5">
                <div className="bg-surface-2 rounded-sm" style={{ height: `${40 + (i % 3) * 20}px` }} />
                <div className="bg-surface-3 rounded-sm" style={{ height: `${20 + (i % 2) * 10}px` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Before/after comparison section */}
        <div className="h-2.5 w-52 bg-surface-2 rounded mb-3" />
        <div className="bg-surface border border-border rounded-xl p-5 mb-10">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="h-4 w-56 bg-surface-2 rounded mb-1.5" />
              <div className="h-3 w-72 bg-surface-2 rounded" />
            </div>
            <div className="h-8 w-32 bg-surface-2 rounded-lg shrink-0" />
          </div>
          <div className="h-10 w-64 bg-surface-2 rounded mx-auto" />
        </div>

      </main>
    </div>
  );
}
