export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-accent text-white text-[11px] font-bold leading-none">V</span>
            <span className="font-semibold text-[14px] tracking-tight text-ink">Voxray</span>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 pb-16">
        <div className="py-6 border-b border-border mb-8 grid grid-cols-4 md:grid-cols-7 gap-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 bg-surface-2 rounded animate-pulse mb-2" />
              <div className="h-7 w-12 bg-surface-2 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-6 w-48 bg-surface-2 rounded animate-pulse mb-6" />
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-6 bg-surface-2 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-surface-2 rounded animate-pulse" />
              <div className="h-6 w-12 bg-surface-2 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
