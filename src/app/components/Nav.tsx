import Link from 'next/link';

interface NavProps {
  activeCalls?: number;
}

export function Nav({ activeCalls = 0 }: NavProps) {
  return (
    <header className="bg-surface border-b border-border sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-accent text-white text-[11px] font-bold leading-none">
            V
          </span>
          <span className="font-semibold text-[14px] tracking-tight text-ink">Voxray</span>
        </Link>

        {/* Center — nav links + live status */}
        <div className="flex items-center gap-6 text-xs">
          <Link href="/dashboard" className="text-ink-3 hover:text-ink transition-colors font-medium">Agents</Link>
          <div className="flex items-center gap-1.5 text-ink-3">
            {activeCalls > 0 ? (
              <span className="flex items-center gap-1.5 text-accent font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse inline-block" />
                {activeCalls} live
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-ok inline-block" />
                monitoring
              </span>
            )}
          </div>
        </div>

        {/* Right */}
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            className="text-xs text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
