import Link from 'next/link';

export function Nav() {
  return (
    <header className="bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-13 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-accent text-white text-xs font-bold leading-none">
            V
          </span>
          <span className="font-semibold text-[15px] tracking-tight text-ink">Voxray</span>
        </Link>

        {/* Right */}
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            className="text-xs text-ink-3 hover:text-ink px-3 py-1.5 rounded-md border border-border hover:border-border transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
