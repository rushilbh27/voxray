import Link from 'next/link';

export const revalidate = 3600;

const STATS = [
  { value: '1,808', label: 'calls analyzed' },
  { value: '52%',   label: 'error rate found' },
  { value: '11',    label: 'agents monitored' },
  { value: '21',    label: 'error types detected' },
];

const FEATURES = [
  {
    title: 'Error detection per call',
    body: 'Claude Haiku 4.5 audits every transcript against agent-type-specific rules. 21 error types, severity-ranked, with exact agent quotes.',
  },
  {
    title: 'LLM observability',
    body: 'Every Haiku call logs latency, token cost, and model version to llm_traces. p50/p95 latency and daily cost visible in the dashboard.',
  },
  {
    title: 'Eval framework',
    body: 'Human FP marks drive precision per error type. Each error shows a confidence score and a 🟢/🟡/🔴 quality badge. Model accountability, not just model output.',
  },
  {
    title: 'Prompt versioning',
    body: 'SHA-256 hashes agent system prompts at analysis time. Error rate by prompt version shows whether fixes actually work.',
  },
  {
    title: 'Real-time pipeline',
    body: 'Ultravox webhook fires within seconds of call end. HMAC-verified, 204 ACK instant, analysis runs in next/server after(). No polling.',
  },
  {
    title: 'Fix suggestions',
    body: 'Structured Find → Replace patches per error type. Live prompt check marks already-applied fixes. 21 patch specs, each with root cause analysis.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-accent text-white text-[11px] font-bold leading-none">V</span>
            <span className="font-semibold text-[14px] tracking-tight text-ink">Voxray</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">

        {/* Hero */}
        <section className="pt-20 pb-16 border-b border-border">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-4">
              Production Voice AI Observability
            </div>
            <h1 className="text-4xl font-black text-ink leading-tight tracking-tight mb-6">
              X-ray vision for<br />Ultravox voice agents
            </h1>
            <p className="text-base text-ink-2 leading-relaxed mb-8 max-w-xl">
              Voxray detects exact agent mistakes per call, surfaces error patterns across agents,
              and drives a prompt improvement feedback loop — replacing manual call review with
              automated AI evaluation. Built on real Uganda production data.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                View dashboard
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

        {/* Stats */}
        <section className="py-10 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <div className="text-3xl font-black text-ink tabular-nums mb-1">{value}</div>
                <div className="text-xs text-ink-3 uppercase tracking-wide font-medium">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-6">
            Real production data — Uganda B2B clients: Ramco Gas, Edifice Properties, Davansh Investment.
          </p>
        </section>

        {/* Features */}
        <section className="py-12 border-b border-border">
          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-8">System design</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            {FEATURES.map(({ title, body }) => (
              <div key={title}>
                <h3 className="text-sm font-semibold text-ink mb-1.5">{title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="py-12 border-b border-border">
          <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest mb-6">Stack</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['Framework',        'Next.js 16 App Router'],
              ['AI primary',       'Claude Haiku 4.5 (Anthropic)'],
              ['AI enrichment',    'Llama 3.2 (self-hosted)'],
              ['Database',         'Supabase (Postgres)'],
              ['Voice platform',   'Ultravox (webhook + REST)'],
              ['Alerts',           'Telegram Bot API'],
              ['Deployment',       'Vercel (serverless + cron)'],
              ['Performance',      '8 Postgres RPC functions, <2s load'],
              ['Observability',    'llm_traces: latency · tokens · cost'],
            ].map(([layer, tech]) => (
              <div key={layer} className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ink-3 uppercase tracking-wide font-medium">{layer}</span>
                <span className="text-ink font-medium text-sm">{tech}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 flex items-center justify-between text-xs text-ink-3">
          <span>Built by <a href="https://github.com/rushilbh27" className="text-ink-2 hover:text-ink transition-colors">Rushil Bhor</a></span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/rushilbh27/voxray" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition-colors">GitHub</a>
            <Link href="/dashboard" className="hover:text-ink transition-colors">Dashboard</Link>
          </div>
        </footer>

      </main>
    </div>
  );
}
