import Link from 'next/link';
import { HeroScroll, type Phase } from '@/app/components/HeroScroll';

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

// ─────────────────────────────────────────────────────────────────────────────
// Below-fold content — data-led, benefit-framed
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '1,808+', label: 'calls analyzed',         sub: 'and counting' },
  { value: '52%',    label: 'error rate found',        sub: 'before clients noticed' },
  { value: '<3s',    label: 'call-end to first alert', sub: 'real-time pipeline' },
  { value: '21',     label: 'error types detected',    sub: 'auto-classified' },
] as const;

const BENEFITS = [
  {
    tag:   'Catch',
    title: 'Know about every mistake before your client does',
    body:  'Every transcript analyzed the second a call ends. Errors ranked by severity. Exact quotes from the agent showing what went wrong — so you fix the right thing.',
    proof: '52% of calls had at least one detectable error.',
  },
  {
    tag:   'Fix',
    title: 'Ship prompt fixes with a single click',
    body:  'Every error surfaces a verified patch — exact text to find, exact text to replace, line number confirmed against the live prompt. No guessing, no diff hunting.',
    proof: '21 error types. Each with a structured fix ready to apply.',
  },
  {
    tag:   'Prove',
    title: 'Know your fix actually worked',
    body:  "Error rate tracked by prompt version. If a fix didn't take, you see it in the next batch. If it worked, you have the before/after numbers to show it.",
    proof: 'SHA-256 prompt versioning. Error rate per version, per agent.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-canvas min-h-screen">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-13 flex items-center px-8 md:px-12"
        style={{
          background:           'oklch(14% 0.012 55 / 0.75)',
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom:         '1px solid oklch(28% 0.013 55 / 0.45)',
        }}
      >
        {/* Logo */}
        <div className="flex-1 flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-[1.625rem] h-[1.625rem] rounded-md text-[11px] font-black leading-none select-none"
            style={{ background: 'var(--color-accent)', color: 'var(--color-canvas)' }}
            aria-hidden="true"
          >
            V
          </span>
          <span className="font-bold text-[14px] tracking-tight text-ink">Voxray</span>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent-hover text-canvas text-[12px] font-bold rounded-md transition-colors"
        >
          Open dashboard
        </Link>
      </header>

      {/* ── Scroll-driven video hero ───────────────────────────────── */}
      <HeroScroll
        src="/hero-final.mp4"
        scrollHeight="400vh"
        phases={PHASES}
      />

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <section
        style={{
          borderTop:    '1px solid oklch(28% 0.013 55 / 0.6)',
          borderBottom: '1px solid oklch(28% 0.013 55 / 0.6)',
          background:   'oklch(17.5% 0.014 55)',
        }}
      >
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {STATS.map(({ value, label, sub }) => (
              <div key={label} className="flex flex-col gap-1">
                <span
                  className="font-black tabular-nums leading-none tracking-[-0.03em]"
                  style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', color: 'var(--color-accent)' }}
                >
                  {value}
                </span>
                <span className="text-[13px] font-semibold text-ink leading-snug">{label}</span>
                <span className="text-[11px] text-ink-3 uppercase tracking-wide">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ──────────────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid oklch(28% 0.013 55 / 0.6)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-24">

          <div className="mb-16">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-3 mb-4">
              Why it matters
            </p>
            <h2
              className="font-black text-ink leading-[1.05] tracking-[-0.025em]"
              style={{ fontSize: 'clamp(1.9rem, 3.8vw, 3rem)', maxWidth: '22ch' }}
            >
              Voice AI errors are silent until a client notices. Then it&rsquo;s too late.
            </h2>
          </div>

          <div className="space-y-0">
            {BENEFITS.map(({ tag, title, body, proof }, i) => (
              <div
                key={tag}
                className="group py-10 flex flex-col md:flex-row md:items-start gap-6 md:gap-16"
                style={{
                  borderTop: i > 0 ? '1px solid oklch(28% 0.013 55 / 0.5)' : undefined,
                }}
              >
                {/* Tag + number */}
                <div className="shrink-0 flex items-center gap-3 md:flex-col md:items-start md:w-28">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.22em] px-2.5 py-1 rounded"
                    style={{
                      background: 'var(--color-accent-bg)',
                      color:      'var(--color-accent)',
                      border:     '1px solid var(--color-accent-border)',
                    }}
                  >
                    {tag}
                  </span>
                  <span className="text-[11px] font-mono text-ink-3">0{i + 1}</span>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-[1.25rem] font-bold text-ink leading-snug tracking-tight mb-3">
                    {title}
                  </h3>
                  <p className="text-[14px] text-ink-2 leading-relaxed max-w-[52ch] mb-4">
                    {body}
                  </p>
                  <p
                    className="text-[11px] font-mono"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {proof}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ──────────────────────────────────────────────── */}
      <section
        style={{
          borderBottom: '1px solid oklch(28% 0.013 55 / 0.6)',
          background:   'oklch(17.5% 0.014 55)',
        }}
      >
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-20 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div>
            <h2
              className="font-black text-ink leading-tight tracking-[-0.02em] mb-3"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}
            >
              Stop finding out from clients.
            </h2>
            <p className="text-[14px] text-ink-2 max-w-[44ch]">
              Voxray catches every voice AI error automatically — before anyone calls to complain.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-canvas text-sm font-bold rounded-lg transition-colors"
            >
              Open dashboard →
            </Link>
            <a
              href="https://github.com/rushilbh27/voxray"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-3 hover:text-ink transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── How it works (data-led, no feature names) ─────────────── */}
      <section style={{ borderBottom: '1px solid oklch(28% 0.013 55 / 0.6)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ink-3 mb-10">
            Under the hood
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-10">
            {[
              {
                n: '01',
                head: 'Real-time, always',
                body: 'Analysis triggers the second a call ends. No batch jobs. No cron delays. Errors surface in under 3 seconds.',
              },
              {
                n: '02',
                head: 'Structured, not summaries',
                body: 'Every error has a type, severity, confidence score, and exact agent quote. Not a summary — a surgical finding.',
              },
              {
                n: '03',
                head: 'Closed feedback loop',
                body: 'Apply a fix. See the error rate drop by version. If it regresses, an alert fires before a client notices.',
              },
            ].map(({ n, head, body }) => (
              <div key={n}>
                <p className="font-mono text-[11px] text-ink-3 mb-3">{n}</p>
                <h3 className="text-[15px] font-bold text-ink mb-2 leading-snug">{head}</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer>
        <div
          className="max-w-5xl mx-auto px-8 md:px-12 py-8 flex items-center justify-between text-xs text-ink-3"
        >
          <span>
            Built by{' '}
            <a
              href="https://github.com/rushilbh27"
              className="text-ink-2 hover:text-ink transition-colors"
            >
              Rushil Bhor
            </a>
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/rushilbh27/voxray"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              GitHub
            </a>
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
