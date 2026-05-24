'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// ─── Data ────────────────────────────────────────────────────────────────────

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
    icon:  '◉',
  },
  {
    tag:   'Fix',
    title: 'Ship prompt fixes with a single click',
    body:  'Every error surfaces a verified patch — exact text to find, exact text to replace, line number confirmed against the live prompt. No guessing, no diff hunting.',
    proof: '21 error types. Each with a structured fix ready to apply.',
    icon:  '◈',
  },
  {
    tag:   'Prove',
    title: 'Know your fix actually worked',
    body:  'Error rate tracked by prompt version. If a fix did not take, you see it in the next batch. If it worked, you have the before/after numbers to show it.',
    proof: 'SHA-256 prompt versioning. Error rate per version, per agent.',
    icon:  '◆',
  },
] as const;

const HOW_IT_WORKS = [
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
] as const;

// ─── Hook: batch reveal on scroll ────────────────────────────────────────────

function useBatchReveal(selector: string, scopeRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.set(selector, { autoAlpha: 0, y: 28 });
      ScrollTrigger.batch(selector, {
        start: 'top 88%',
        onEnter: (els) =>
          gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            stagger: 0.1,
            ease: 'expo.out',
            overwrite: true,
          }),
        onLeaveBack: (els) =>
          gsap.set(els, { autoAlpha: 0, y: 28, overwrite: true }),
      });
    }, scopeRef as React.RefObject<HTMLElement>);
    return () => ctx.revert();
  }, [selector]);
}

// ─── Stats Section ────────────────────────────────────────────────────────────

function StatsSection() {
  const ref = useRef<HTMLElement>(null);
  useBatchReveal('[data-reveal="stat"]', ref);

  return (
    <section
      ref={ref}
      className="border-y border-border/60 bg-surface"
    >
      <div className="max-w-5xl mx-auto px-8 md:px-12 py-16">
        {/* Label bar */}
        <div className="flex items-center gap-3 mb-12" data-reveal="stat">
          <span className="inline-block w-2 h-2 rounded-none bg-accent" />
          <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-accent font-[family-name:var(--font-mono)]">
            Live metrics
          </span>
          <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-ink-3 font-[family-name:var(--font-mono)]">
            1,808 calls · Uganda
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 border-border/50">
          {STATS.map(({ value, label, sub }) => (
            <div
              key={label}
              data-reveal="stat"
              className="flex flex-col gap-1.5 px-0 py-6 md:px-8 first:pl-0"
            >
              <span className="font-black tabular-nums leading-none tracking-[-0.04em] text-accent font-[family-name:var(--font-mono)] text-[clamp(2.4rem,4.5vw,3.2rem)]">
                {value}
              </span>
              <span className="text-[12px] font-semibold leading-snug text-ink">
                {label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3 font-[family-name:var(--font-mono)]">
                {sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Benefits Section ─────────────────────────────────────────────────────────

function BenefitsSection() {
  const ref = useRef<HTMLElement>(null);
  useBatchReveal('[data-reveal="benefit"]', ref);

  return (
    <section ref={ref} className="border-b border-border/60 bg-canvas">
      <div className="max-w-5xl mx-auto px-8 md:px-12 py-24">
        {/* Section header */}
        <div className="mb-16" data-reveal="benefit">
          <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.28em] text-accent font-[family-name:var(--font-mono)]">
            Why it matters
          </p>
          <h2 className="font-black leading-[1.02] tracking-[-0.025em] max-w-[22ch] text-ink text-[clamp(1.9rem,3.8vw,3rem)]">
            Voice AI errors are silent until a client notices. Then it&rsquo;s too late.
          </h2>
        </div>

        {/* Benefit rows */}
        <div>
          {BENEFITS.map(({ tag, title, body, proof, icon }, i) => (
            <div
              key={tag}
              data-reveal="benefit"
              className="group relative py-10 flex flex-col md:flex-row md:items-start gap-6 md:gap-16 border-t border-border/40"
            >
              {/* Hover accent line */}
              <div className="absolute left-0 top-0 h-px w-0 group-hover:w-full transition-all duration-500 bg-accent ease-[cubic-bezier(0.22,1,0.36,1)]" />

              {/* Tag column */}
              <div className="shrink-0 flex items-center gap-3 md:flex-col md:items-start md:w-32">
                <span className="text-[9px] font-bold uppercase tracking-[0.22em] px-2.5 py-1 bg-accent-bg text-accent border border-accent-border font-[family-name:var(--font-mono)]">
                  {tag}
                </span>
                <span
                  className="text-[28px] leading-none text-border-strong"
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="text-[10px] tabular-nums text-ink-3 font-[family-name:var(--font-mono)]">
                  0{i + 1}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-[1.2rem] font-bold leading-snug tracking-tight mb-3 text-ink">
                  {title}
                </h3>
                <p className="text-[14px] leading-relaxed max-w-[52ch] mb-5 text-ink-2">
                  {body}
                </p>

                {/* Proof pill */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border-strong">
                  <span className="w-1.5 h-1.5 rounded-none bg-accent shrink-0" />
                  <span className="text-[10px] tabular-nums text-accent font-[family-name:var(--font-mono)]">
                    {proof}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Band ─────────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef<HTMLElement>(null);
  useBatchReveal('[data-reveal="cta"]', ref);

  return (
    <section ref={ref} className="border-b border-border/60 bg-surface relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="glow-bg" aria-hidden />

      <div className="relative max-w-5xl mx-auto px-8 md:px-12 py-24">
        <div
          data-reveal="cta"
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-10"
        >
          <div>
            <p className="mb-4 text-[9px] font-bold uppercase tracking-[0.28em] text-accent font-[family-name:var(--font-mono)]">
              Get started
            </p>
            <h2 className="font-black leading-tight tracking-[-0.02em] mb-4 text-ink text-[clamp(1.7rem,3.2vw,2.6rem)]">
              Stop finding out from clients.
            </h2>
            <p className="text-[14px] leading-relaxed max-w-[44ch] text-ink-2">
              Voxray catches every voice AI error automatically — before anyone calls to complain.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 font-bold text-[13px] transition-all duration-200 hover:gap-4 bg-accent text-canvas font-[family-name:var(--font-mono)] tracking-[0.02em]"
            >
              Open dashboard
              <span aria-hidden className="text-[16px]">→</span>
            </Link>
            <a
              href="https://github.com/rushilbh27/voxray"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] transition-colors text-ink-3 hover:text-ink font-[family-name:var(--font-mono)]"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it Works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null);
  useBatchReveal('[data-reveal="how"]', ref);

  return (
    <section ref={ref} className="border-b border-border/60 bg-canvas">
      <div className="max-w-5xl mx-auto px-8 md:px-12 py-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-16" data-reveal="how">
          <div>
            <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.28em] text-accent font-[family-name:var(--font-mono)]">
              Under the hood
            </p>
            <h2 className="font-black tracking-[-0.02em] leading-tight text-ink text-[clamp(1.4rem,2.8vw,2rem)]">
              How the pipeline runs
            </h2>
          </div>

          {/* Live indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 mt-1 border border-accent-border bg-surface-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-accent" />
            <span className="text-[9px] uppercase tracking-[0.22em] text-accent font-[family-name:var(--font-mono)]">
              Live
            </span>
          </div>
        </div>

        {/* Steps — bento-style cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border/40">
          {HOW_IT_WORKS.map(({ n, head, body }) => (
            <div
              key={n}
              data-reveal="how"
              className="group relative p-8 flex flex-col gap-6 transition-colors duration-300 bg-canvas hover:bg-surface"
            >
              {/* Number */}
              <span className="text-[10px] tabular-nums text-accent font-[family-name:var(--font-mono)] tracking-[0.1em]">
                {n}
              </span>

              {/* Accent line grows on hover */}
              <div className="absolute top-0 left-0 w-0 h-px group-hover:w-full transition-all duration-500 bg-accent ease-[cubic-bezier(0.22,1,0.36,1)]" />

              <div>
                <h3 className="text-[15px] font-bold mb-3 leading-snug text-ink">
                  {head}
                </h3>
                <p className="text-[13px] leading-relaxed text-ink-3">
                  {body}
                </p>
              </div>

              {/* Bottom stat strip */}
              <div className="mt-auto pt-4 border-t border-border/60">
                {n === '01' && (
                  <span className="text-[11px] tabular-nums font-bold text-ok font-[family-name:var(--font-mono)]">
                    &lt;3s latency
                  </span>
                )}
                {n === '02' && (
                  <span className="text-[11px] tabular-nums font-bold text-accent font-[family-name:var(--font-mono)]">
                    21 error types
                  </span>
                )}
                {n === '03' && (
                  <span className="text-[11px] tabular-nums font-bold text-ok font-[family-name:var(--font-mono)]">
                    SHA-256 versioned
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline diagram strip */}
        <div
          data-reveal="how"
          className="mt-8 px-6 py-4 flex flex-wrap items-center gap-3 border border-border/50 bg-surface"
        >
          {[
            { step: 'Call ends', color: 'text-ink-2' },
            null,
            { step: 'Transcript', color: 'text-ink-2' },
            null,
            { step: 'LLM analysis', color: 'text-accent' },
            null,
            { step: 'Error classification', color: 'text-accent' },
            null,
            { step: 'Alert + patch', color: 'text-ok' },
          ].map((item, i) =>
            item === null ? (
              <span
                key={i}
                className="text-[10px] text-ink-3/70 font-[family-name:var(--font-mono)]"
              >
                →
              </span>
            ) : (
              <span
                key={i}
                className={`text-[10px] font-bold uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] ${item.color}`}
              >
                {item.step}
              </span>
            )
          )}
          <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-ink-3 font-[family-name:var(--font-mono)]">
            &lt;3s end-to-end
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-canvas">
      <div className="max-w-5xl mx-auto px-8 md:px-12 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border/50">
        {/* Logo + tagline */}
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-6 h-6 text-[10px] font-black select-none bg-accent text-canvas"
            aria-hidden
          >
            V
          </span>
          <span className="text-[11px] text-ink-3 font-[family-name:var(--font-mono)]">
            Voxray — Voice AI Observability
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3/80 font-[family-name:var(--font-mono)]">
            Built by{' '}
            <a
              href="https://github.com/rushilbh27"
              className="transition-colors text-ink-3 hover:text-ink"
            >
              Rushil Bhor
            </a>
          </span>
          <a
            href="https://github.com/rushilbh27/voxray"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-[0.18em] transition-colors text-ink-3 hover:text-ink-2 font-[family-name:var(--font-mono)]"
          >
            GitHub ↗
          </a>
          <Link
            href="/dashboard"
            className="text-[10px] uppercase tracking-[0.18em] transition-colors text-ink-3 hover:text-ink-2 font-[family-name:var(--font-mono)]"
          >
            Dashboard →
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Composed export ──────────────────────────────────────────────────────────

export function HomeSections() {
  return (
    <>
      <StatsSection />
      <BenefitsSection />
      <CTASection />
      <HowItWorksSection />
      <Footer />
    </>
  );
}
