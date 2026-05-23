import Link from 'next/link';
import { HeroScroll, type Phase } from '@/app/components/HeroScroll';

export const revalidate = 3600;

// ─────────────────────────────────────────────────────────────────────────────
// Hero — hero-main.mp4 (8 s, 1920 × 1080 @ 30 fps)
//
// Video timeline:
//   0.00–0.70  Hands approaching, amber glow building
//   0.775      EXPLOSION — fingers touch, light erupts (≈ 6.2 s)
//   0.775+     Aftermath, hands separate, scene darkens
//
// Phase rhythm: set up → insight → [explosion gap] → resolution + CTA
// Text-free during explosion (0.60–0.80) — visual speaks for itself.
// ─────────────────────────────────────────────────────────────────────────────
const PHASES: Phase[] = [
  {
    start: 0.0,
    end:   0.27,
    eyebrow: 'Production Voice AI Observability',
    headline: 'X-ray vision\nfor voice agents',
    body: 'Every call analyzed. Every mistake found. Before the client calls to complain.',
  },
  {
    start: 0.31,
    end:   0.58,
    eyebrow: '1,808 calls · Uganda production',
    headline: '52% had errors.\nWe found them first.',
    body: 'Ramco Gas, Edifice Properties, Davansh Investment. Real calls. Real stakes.',
  },
  // 0.60–0.80: intentionally empty — the explosion is the message
  {
    start: 0.82,
    end:   0.97,
    eyebrow: 'Webhook → Haiku → Telegram',
    headline: 'Seconds after\nthe call ends.',
    body: 'No polling. No batch delay. The pipeline fires the moment Ultravox signals call-ended.',
    cta: { label: 'Open dashboard', href: '/dashboard' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Below-fold content
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_EVENTS = [
  {
    ts:    '00:00.000',
    color: 'text-ok',
    label: 'Call ended — Ultravox webhook fires',
    detail: null,
  },
  {
    ts:    '00:00.204',
    color: 'text-ok',
    label: 'HMAC signature verified · transcript received',
    detail: null,
  },
  {
    ts:    '00:02.847',
    color: 'text-warn',
    label: 'Claude Haiku: 3 errors detected',
    detail: 'no_save_answers · wrong_info · stacked_questions',
  },
  {
    ts:    '00:02.851',
    color: 'text-accent',
    label: 'Repeat tracker: 4th occurrence in 30 days — auto-apply eligible',
    detail: null,
  },
  {
    ts:    '00:03.001',
    color: 'text-crit',
    label: 'Telegram alert — Davansh Investment: 3 errors · patch available',
    detail: null,
  },
] as const;

const SYSTEM_FEATURES = [
  {
    title: 'Error detection per call',
    body:  'Claude Haiku 4.5 audits every transcript against agent-type-specific rules. 21 error types, severity-ranked, exact agent quotes.',
  },
  {
    title: 'Prompt versioning',
    body:  'SHA-256 hashes agent system prompts at analysis time. Error rate by prompt version shows whether fixes actually worked.',
  },
  {
    title: 'Real-time pipeline',
    body:  'Ultravox webhook fires within seconds of call end. HMAC-verified, 204 ACK instant, Haiku analysis runs in background.',
  },
  {
    title: 'Eval framework',
    body:  'Human FP marks drive precision per error type. Each error shows a confidence score and quality badge. Model accountability.',
  },
  {
    title: 'LLM observability',
    body:  'Every Haiku call logs latency, token cost, and model version to llm_traces. p50/p95 and daily cost visible on the dashboard.',
  },
  {
    title: 'Fix suggestions',
    body:  'Structured Find → Replace patches per error type. Live prompt check marks already-applied fixes. 21 patch specs with root-cause analysis.',
  },
] as const;

const STACK = [
  ['Framework',     'Next.js 16 App Router'],
  ['AI primary',    'Claude Haiku 4.5 (Anthropic)'],
  ['AI enrichment', 'Llama 3.2 (self-hosted)'],
  ['Database',      'Supabase (Postgres)'],
  ['Voice platform','Ultravox (webhook + REST)'],
  ['Alerts',        'Telegram Bot API'],
  ['Deployment',    'Vercel (serverless + cron)'],
  ['Observability', 'llm_traces: latency · tokens · cost'],
  ['Performance',   '8 RPC functions, <2s load'],
] as const;

// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-canvas min-h-screen">

      {/* ── Fixed nav ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-12 flex items-center px-8 md:px-12 border-b"
        style={{
          borderColor:         'oklch(28% 0.013 55 / 0.55)',
          background:          'oklch(14% 0.012 55 / 0.80)',
          backdropFilter:      'blur(16px)',
          WebkitBackdropFilter:'blur(16px)',
        }}
      >
        <div className="flex-1 flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-black leading-none select-none"
            style={{ background: 'var(--color-accent)', color: 'var(--color-canvas)' }}
            aria-hidden="true"
          >
            V
          </span>
          <span className="font-semibold text-[14px] tracking-tight text-ink">
            Voxray
          </span>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          Dashboard →
        </Link>
      </header>

      {/* ── Scroll-driven video hero ───────────────────────────────── */}
      <HeroScroll
        src="/hero-main.mp4"
        scrollHeight="420vh"
        phases={PHASES}
        explosionAt={0.775}
      />

      {/* ── Editorial statement + pipeline trace ──────────────────── */}
      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-24">

          {/* Statement */}
          <h2
            className="font-black leading-[1.07] tracking-[-0.025em] text-ink"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', maxWidth: '21ch' }}
          >
            1,808 calls analyzed.{' '}
            <span className="text-accent">52%</span>{' '}
            had errors. All caught before Uganda clients noticed.
          </h2>

          <p className="mt-6 text-[15px] text-ink-2 leading-relaxed max-w-[56ch]">
            Voxray answers: what broke, which agent, how often, what to fix.
            Not a metrics viewer — a closed feedback loop between live call mistakes and prompt patches.
          </p>

          {/* Pipeline trace */}
          <div
            className="mt-16 space-y-3.5"
            aria-label="Real call analysis pipeline trace"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3 mb-5">
              Live call trace · Davansh Investment · 2026-05-22
            </p>
            {PIPELINE_EVENTS.map(({ ts, color, label, detail }) => (
              <div
                key={ts}
                className="flex items-baseline gap-4 font-mono text-[11px] leading-relaxed"
              >
                <span className="text-ink-3 tabular-nums shrink-0 w-[6.5rem]">{ts}</span>
                <span className={`shrink-0 ${color}`} aria-hidden="true">●</span>
                <span className="text-ink-2">{label}</span>
                {detail && (
                  <span className="text-crit font-semibold hidden sm:inline">{detail}</span>
                )}
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-14 flex items-center gap-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-canvas text-sm font-semibold rounded-lg transition-colors"
            >
              Open dashboard
            </Link>
            <a
              href="https://github.com/rushilbh27/voxray"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-ink-3 hover:text-ink transition-colors"
            >
              GitHub →
            </a>
          </div>
        </div>
      </section>

      {/* ── System design ─────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3 mb-12">
            System design
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {SYSTEM_FEATURES.map(({ title, body }) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-ink mb-1.5">{title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ─────────────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3 mb-8">
            Stack
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {STACK.map(([layer, tech]) => (
              <div key={layer} className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-3">
                  {layer}
                </span>
                <span className="text-sm font-medium text-ink">{tech}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-8 flex items-center justify-between text-xs text-ink-3">
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
