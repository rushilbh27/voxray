import Link from 'next/link';
import { HeroScroll, type Phase } from '@/app/components/HeroScroll';
import { HomeSections } from '@/app/components/HomeSections';

export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────────
// Video: hero-final.mp4 · 7s · 1920×1080 @ 30fps
//
// Arc: hands apart (0s) → approach + glow builds (2.5s) → fingers touch,
//      starburst (4.5s) → aftermath + sparks (6.5s)
//
// Copy: benefits-first, no client names, no agent names, data-led
// ─────────────────────────────────────────────────────────────────────────────
const PHASES: Phase[] = [
  {
    start: 0.00,
    end:   0.28,
    eyebrow: 'Voice AI Observability',
    headline: 'Your agents are\nmaking mistakes.\nRight now.',
    body: 'Silent errors compound into churned clients. Every missed answer, every wrong response — invisible until a client complains.',
  },
  {
    start: 0.32,
    end:   0.60,
    eyebrow: '52% error rate · detected automatically',
    headline: 'Caught in seconds.\nFixed in one click.',
    body: 'Real-time analysis fires the moment a call ends. Structured patches, verified against the live prompt, ready to apply.',
  },
  {
    start: 0.68,
    end:   0.96,
    eyebrow: '< 3 s from call-end to alert',
    headline: 'Fix it once.\nProve it worked.',
    body: 'Error rate drops by prompt version. Every fix ships with before/after proof. Know it worked before the next call.',
    cta: { label: 'Open dashboard', href: '/dashboard' },
  },
];

export default function HomePage() {
  return (
    <div className="bg-canvas min-h-screen">

      {/* ── Floating Nav ─────────────────────────────────────────────── */}
      <div className="fixed top-6 inset-x-0 z-50 flex justify-center px-6 pointer-events-none">
        <header className="pointer-events-auto flex items-center justify-between h-12 px-5 w-full max-w-5xl bg-surface/90 backdrop-blur-md border border-border shadow-sm">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center w-6 h-6 text-[10px] font-black leading-none select-none bg-accent text-canvas"
              aria-hidden="true"
            >
              V
            </span>
            <span className="font-bold text-[14px] tracking-tight text-ink">Voxray</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-2">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors border border-border text-ink-2 hover:text-ink hover:border-border-strong"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Docs
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center px-4 py-1.5 bg-accent hover:bg-accent-hover text-canvas text-[11px] font-bold uppercase tracking-[0.1em] transition-colors border border-accent-border"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Open dashboard
            </Link>
          </nav>
        </header>
      </div>

      {/* ── Scroll-driven video hero ───────────────────────────────── */}
      <HeroScroll
        src="/hero-final.mp4"
        scrollHeight="400vh"
        phases={PHASES}
      />

      {/* ── All below-hero sections (GSAP-animated, premium redesign) ─ */}
      <HomeSections />

    </div>
  );
}
