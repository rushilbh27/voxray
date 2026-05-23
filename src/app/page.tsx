import Link from 'next/link';
import { HeroScroll, type Phase } from '@/app/components/HeroScroll';

export const revalidate = 3600;

// ── Video 1 (hero-main.mp4 — 8 s) ──────────────────────────────────────────
// Each phase spans ~2.5 s of video content at 400 vh total scroll distance.
const PHASES_MAIN: Phase[] = [
  {
    start: 0.0,
    end:   0.30,
    eyebrow: 'Production Voice AI Observability',
    headline: 'X-ray vision\nfor voice agents',
    body: 'Every call analyzed. Every mistake found. Before the client calls to complain.',
  },
  {
    start: 0.32,
    end:   0.62,
    eyebrow: '1,808 calls · Uganda production',
    headline: '52% had errors.\nWe found them first.',
    body: 'Ramco Gas, Edifice Properties, Davansh Investment. Real calls. Real stakes.',
  },
  {
    start: 0.65,
    end:   0.93,
    eyebrow: 'Webhook → Haiku → Telegram',
    headline: 'Seconds after\nthe call ends.',
    body: 'No polling. No batch delay. The pipeline fires the moment Ultravox signals call-ended.',
    cta: { label: 'Open dashboard', href: '/dashboard' },
  },
];

// ── Video 2 (hero-feature.mp4 — 5.3 s) ──────────────────────────────────────
const PHASES_FEATURE: Phase[] = [
  {
    start: 0.04,
    end:   0.47,
    eyebrow: 'Find → Replace patch system',
    headline: 'Exact line.\nVerified fix.',
    body: '21 error types. Each with a structured prompt patch. Line numbers checked against the live system prompt before apply.',
  },
  {
    start: 0.55,
    end:   0.95,
    eyebrow: 'Repeat error tracker · auto-heal',
    headline: 'Fixes itself\nwhile you sleep.',
    body: '3 alert tiers: regression, fix available, write patch. Auto-applies when false-positive rate stays under 5%.',
    cta: { label: 'View agent profiles', href: '/dashboard' },
  },
];

const SYSTEM_FEATURES = [
  {
    title: 'Error detection per call',
    body:  'Claude Haiku 4.5 audits every transcript against agent-type-specific rules. 21 error types, severity-ranked, exact agent quotes.',
  },
  {
    title: 'Prompt versioning',
    body:  'SHA-256 hashes agent system prompts at analysis time. Error rate by prompt version shows whether fixes actually work.',
  },
  {
    title: 'Real-time pipeline',
    body:  'Ultravox webhook fires within seconds of call end. HMAC-verified, 204 ACK instant, analysis runs server-side after().',
  },
  {
    title: 'Eval framework',
    body:  'Human FP marks drive precision per error type. Each error shows a confidence score and a quality badge. Model accountability.',
  },
  {
    title: 'LLM observability',
    body:  'Every Haiku call logs latency, token cost, and model version to llm_traces. p50/p95 and daily cost visible on the dashboard.',
  },
  {
    title: 'Fix suggestions',
    body:  'Structured Find → Replace patches per error type. Live prompt check marks already-applied fixes. 21 patch specs, each with root-cause analysis.',
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

export default function HomePage() {
  return (
    <div className="bg-canvas min-h-screen">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 h-12 border-b flex items-center px-8 md:px-12"
        style={{
          borderColor: 'oklch(28% 0.013 55 / 0.6)',
          background:  'oklch(14% 0.012 55 / 0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <div className="flex-1 flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-black leading-none select-none"
            style={{ background: 'var(--color-accent)', color: 'var(--color-canvas)' }}
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

      {/* ── Hero scroll 1 — main (8 s video) ────────────────────────── */}
      <HeroScroll
        src="/hero-main.mp4"
        scrollHeight="400vh"
        phases={PHASES_MAIN}
      />

      {/* ── Hero scroll 2 — feature (5.3 s video) ───────────────────── */}
      <HeroScroll
        src="/hero-feature.mp4"
        scrollHeight="310vh"
        phases={PHASES_FEATURE}
      />

      {/* ── Editorial statement ──────────────────────────────────────── */}
      <section
        className="border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-24">
          <p
            className="text-4xl md:text-[3.25rem] font-black leading-[1.08] tracking-[-0.025em] max-w-[22ch]"
            style={{ color: 'var(--color-ink)' }}
          >
            1,808 calls analyzed.{' '}
            <span style={{ color: 'var(--color-accent)' }}>52%</span> had errors.
            All caught before Uganda clients noticed.
          </p>

          <p
            className="mt-7 text-[15px] max-w-[56ch] leading-relaxed"
            style={{ color: 'var(--color-ink-2)' }}
          >
            Voxray answers: what broke, which agent, how often, what to fix.
            Not a metrics viewer — a closed feedback loop between live call mistakes and prompt patches.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-accent hover:bg-accent-hover text-canvas transition-colors"
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

      {/* ── System design ────────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-20">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em] mb-12"
            style={{ color: 'var(--color-ink-3)' }}
          >
            System design
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
            {SYSTEM_FEATURES.map(({ title, body }) => (
              <div key={title}>
                <h3
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ────────────────────────────────────────────────────── */}
      <section
        className="border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-5xl mx-auto px-8 md:px-12 py-16">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.22em] mb-8"
            style={{ color: 'var(--color-ink-3)' }}
          >
            Stack
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-5">
            {STACK.map(([layer, tech]) => (
              <div key={layer} className="flex flex-col gap-0.5">
                <span
                  className="text-[10px] uppercase tracking-wide font-semibold"
                  style={{ color: 'var(--color-ink-3)' }}
                >
                  {layer}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {tech}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer
        className="border-t"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div
          className="max-w-5xl mx-auto px-8 md:px-12 py-8 flex items-center justify-between text-xs"
          style={{ color: 'var(--color-ink-3)' }}
        >
          <span>
            Built by{' '}
            <a
              href="https://github.com/rushilbh27"
              className="transition-colors"
              style={{ color: 'var(--color-ink-2)' }}
            >
              Rushil Bhor
            </a>
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/rushilbh27/voxray"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-3 hover:text-ink transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/dashboard"
              className="text-ink-3 hover:text-ink transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
