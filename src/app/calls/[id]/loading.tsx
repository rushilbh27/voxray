export default function CallDetailLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav skeleton */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center gap-3">
          <div className="w-5 h-5 rounded-md bg-surface-2 animate-pulse" />
          <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        {/* Breadcrumb */}
        <div className="py-4 mb-2">
          <div className="h-3 w-24 rounded bg-surface-2 animate-pulse" />
        </div>

        {/* Call header card */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-14 rounded-md bg-surface-2 animate-pulse" />
                <div className="h-5 w-32 rounded bg-surface-2 animate-pulse" />
              </div>
              <div className="h-3 w-64 rounded bg-surface-2 animate-pulse" />
              <div className="h-4 w-80 rounded bg-surface-2 animate-pulse mt-2" />
            </div>
            <div className="shrink-0 text-right space-y-1">
              <div className="h-7 w-14 rounded bg-surface-2 animate-pulse" />
              <div className="h-3 w-10 rounded bg-surface-2 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 w-12 rounded bg-surface-2 animate-pulse" />
                <div className="h-3.5 w-24 rounded bg-surface-2 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_4fr] gap-5">

          {/* Transcript skeleton */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
              <div className="h-3 w-16 rounded bg-surface-2 animate-pulse" />
            </div>
            <div className="px-4 py-4 space-y-3">
              {[80, 60, 90, 55, 70, 50, 85, 65].map((w, i) => {
                const isAgent = i % 2 === 0;
                return (
                  <div key={i} className={`flex gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}>
                    <div className="w-6 h-6 rounded-full bg-surface-2 animate-pulse shrink-0" />
                    <div
                      className="h-10 rounded-xl bg-surface-2 animate-pulse"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Error analysis skeleton */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                <div className="h-3 w-28 rounded bg-surface-2 animate-pulse" />
                <div className="h-5 w-16 rounded-md bg-surface-2 animate-pulse" />
              </div>
              <div className="p-5 space-y-3">
                <div className="h-3 w-full rounded bg-surface-2 animate-pulse" />
                <div className="h-3 w-4/5 rounded bg-surface-2 animate-pulse" />
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-surface-2 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-surface-2 animate-pulse" />
                </div>
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-lg p-3.5 border border-border bg-surface-2 space-y-2 animate-pulse">
                    <div className="flex gap-2">
                      <div className="h-3 w-12 rounded bg-surface-3" />
                      <div className="h-3 w-20 rounded bg-surface-3" />
                    </div>
                    <div className="h-3 w-3/4 rounded bg-surface-3" />
                    <div className="h-8 w-full rounded bg-surface-3" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
