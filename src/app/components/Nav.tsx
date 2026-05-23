import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

interface NavProps {
  activeCalls?: number;
}

export function Nav({ activeCalls = 0 }: NavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-canvas/85 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/70">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--color-accent) 60%, transparent) 30%, color-mix(in oklch, var(--color-accent) 80%, transparent) 50%, color-mix(in oklch, var(--color-accent) 60%, transparent) 70%, transparent 100%)',
        }}
      />
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <span
            aria-hidden
            className="relative inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black leading-none text-canvas"
            style={{ background: 'var(--color-accent)' }}
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-md opacity-60 blur-md"
              style={{ background: 'var(--color-accent-glow)' }}
            />
            <span className="relative">V</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-semibold text-[15px] tracking-tight text-ink">Voxray</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">/ ops</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[13px]">
          <NavLink href="/dashboard">Agents</NavLink>
          <NavLink href="/errors">Errors</NavLink>
          <NavLink href="/calls">Calls</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-5">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 pl-1.5 pr-3 py-1">
            <span className={activeCalls > 0 ? 'dot-live' : 'h-2 w-2 rounded-full bg-ok'} />
            <span className="text-[11px] font-medium tracking-wide nums text-ink-2">
              {activeCalls > 0 ? (
                <><span className="text-accent">{activeCalls}</span> live</>
              ) : (
                'monitoring'
              )}
            </span>
          </div>

          <ThemeToggle />

          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="text-[12px] text-ink-3 hover:text-ink transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative px-2.5 py-1 rounded-md text-ink-2 hover:text-ink transition-colors"
    >
      {children}
    </Link>
  );
}
