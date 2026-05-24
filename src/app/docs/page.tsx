import Link from 'next/link';

export const metadata = {
  title: 'Docs — Voxray',
  description: 'Voxray documentation: dashboard features, REST API v1, MCP server, CLI reference.',
};

// ── tiny primitives ────────────────────────────────────────────────────────
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="group flex items-center gap-2 text-[22px] font-bold tracking-tight text-ink mt-12 mb-4 scroll-mt-20">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-40 transition-opacity text-ink-3 text-sm font-normal">#</a>
    </h2>
  );
}
function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="group flex items-center gap-2 text-[16px] font-semibold text-ink mt-8 mb-3 scroll-mt-20">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-40 transition-opacity text-ink-3 text-xs font-normal">#</a>
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-ink-2 leading-relaxed mb-4">{children}</p>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] bg-surface-2 text-accent px-1.5 py-0.5">{children}</code>;
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="text-[13px] font-mono bg-surface-2 border border-border-subtle px-4 py-3.5 overflow-x-auto text-ink-2 mb-4 leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-[13px] border-collapse">
        {children}
      </table>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3 px-3 py-2 border-b border-border-subtle">{children}</th>;
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2.5 border-b border-border-subtle/50 text-ink-2 align-top ${mono ? 'font-mono text-accent text-[12px]' : ''}`}>{children}</td>;
}
function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'crit' | 'warn' | 'ok' | 'default' }) {
  const cls = {
    crit: 'bg-crit-bg text-crit border-crit-border',
    warn: 'bg-warn-bg text-warn border-warn-border',
    ok:   'bg-ok-bg text-ok border-ok-border',
    default: 'bg-surface-2 text-ink-3 border-border-subtle',
  }[tone];
  return <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold border ${cls}`}>{children}</span>;
}
function Callout({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'warn' | 'crit' | 'default' }) {
  const cls = tone === 'crit' ? 'border-crit-border bg-crit-bg text-crit'
    : tone === 'warn' ? 'border-warn-border bg-warn-bg text-warn'
    : 'border-border-subtle bg-surface-2 text-ink-2';
  return <div className={`border px-4 py-3 text-[13px] leading-relaxed mb-4 ${cls}`}>{children}</div>;
}

// ── sidebar nav ────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',    label: 'Overview' },
  { id: 'dashboard',   label: 'Dashboard', children: [
    { id: 'agent-grid',    label: 'Agent Grid' },
    { id: 'agent-profile', label: 'Agent Profile' },
    { id: 'call-detail',   label: 'Call Detail' },
    { id: 'cost-strip',    label: 'Cost & Usage' },
  ]},
  { id: 'api',         label: 'REST API v1', children: [
    { id: 'api-auth',    label: 'Authentication' },
    { id: 'api-stats',   label: 'GET /stats' },
    { id: 'api-errors',  label: 'GET /errors' },
    { id: 'api-calls',   label: 'GET /calls' },
    { id: 'api-call-id', label: 'GET /calls/:id' },
    { id: 'api-export',  label: 'GET /export' },
  ]},
  { id: 'mcp',         label: 'MCP Server', children: [
    { id: 'mcp-setup',  label: 'Setup' },
    { id: 'mcp-tools',  label: 'Tools' },
  ]},
  { id: 'cli',         label: 'CLI', children: [
    { id: 'cli-stats',   label: 'stats' },
    { id: 'cli-errors',  label: 'errors' },
    { id: 'cli-calls',   label: 'calls' },
    { id: 'cli-call',    label: 'call <id>' },
    { id: 'cli-analyze', label: 'analyze <id>' },
    { id: 'cli-sync',    label: 'sync' },
    { id: 'cli-monitor', label: 'monitor' },
  ]},
  { id: 'alerting',    label: 'Alerting' },
  { id: 'error-types', label: 'Error Types' },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">

      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-12 border-b border-border-subtle bg-canvas/90 backdrop-blur-md flex items-center px-6 gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="h-6 w-6 bg-accent flex items-center justify-center text-canvas font-black text-[11px]">V</span>
          <span className="text-[13px] font-semibold text-ink">Voxray</span>
        </Link>
        <span className="h-4 w-px bg-border-subtle" />
        <span className="text-[12px] text-ink-3 font-medium">Documentation</span>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/" className="text-[12px] text-ink-3 hover:text-ink transition-colors font-[family-name:var(--font-mono)]">← Home</Link>
          <Link href="/dashboard" className="text-[12px] text-ink-3 hover:text-ink transition-colors font-[family-name:var(--font-mono)]">Dashboard →</Link>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="hidden md:block w-56 shrink-0 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto border-r border-border-subtle py-8 px-4">
          {NAV.map((section) => (
            <div key={section.id} className="mb-4">
              <a href={`#${section.id}`} className="block text-[12px] font-semibold text-ink-2 hover:text-accent mb-1.5 transition-colors">
                {section.label}
              </a>
              {section.children?.map((child) => (
                <a key={child.id} href={`#${child.id}`} className="block text-[11px] text-ink-3 hover:text-ink-2 py-0.5 pl-3 border-l border-border-subtle hover:border-border transition-colors">
                  {child.label}
                </a>
              ))}
            </div>
          ))}
        </aside>

        {/* ── Content ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-8 py-10 max-w-3xl">

          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          <div id="overview" className="scroll-mt-20">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent mb-3">Voxray</div>
            <h1 className="text-[36px] font-black tracking-tight text-ink mb-3">Documentation</h1>
            <P>
              Voxray is a call intelligence dashboard for Ultravox voice agents. It detects exact
              agent mistakes per call, surfaces error patterns, and generates verified prompt
              patches — replacing manual call review with automated AI evaluation.
            </P>
            <P>
              <strong className="text-ink">Live:</strong>{' '}
              <a href="https://voxray.vercel.app" className="text-accent hover:underline">voxray.vercel.app</a>
            </P>
            <div className="grid grid-cols-3 gap-3 mt-6 mb-2">
              {[
                { n: '1,846+', l: 'calls synced' },
                { n: '55%',    l: 'error rate detected' },
                { n: '<3s',    l: 'webhook latency' },
              ].map(({ n, l }) => (
                <div key={l} className="border border-border-subtle bg-surface p-4">
                  <div className="text-[22px] font-black nums text-accent">{n}</div>
                  <div className="text-[11px] text-ink-3 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-border-subtle my-10" />

          {/* ── DASHBOARD ────────────────────────────────────────── */}
          <H2 id="dashboard">Dashboard</H2>

          <H3 id="agent-grid">Agent Grid — <Code>/dashboard</Code></H3>
          <P>Top-level view. All monitored agents sorted by call volume.</P>
          <P>Each agent card shows:</P>
          <ul className="text-[14px] text-ink-2 mb-4 space-y-1.5 pl-4">
            {[
              'Display name + call volume',
              'Error rate with color tone (green <40%, amber 40–60%, red >60%)',
              'Critical alert count badge (red if > 0)',
              'Sparkline — 8-week error rate trend',
              'Top error type for the agent',
            ].map((t) => <li key={t} className="flex gap-2"><span className="text-accent shrink-0 mt-0.5">·</span>{t}</li>)}
          </ul>
          <P>Click any card to open the agent profile.</P>

          <H3 id="agent-profile">Agent Profile — <Code>/dashboard/[agentId]</Code></H3>
          <Table>
            <thead><tr><Th>Section</Th><Th>What it shows</Th></tr></thead>
            <tbody>
              {[
                ['Stat strip', 'Total calls · analyzed · error rate · calls with errors · critical count'],
                ['Error Intelligence', 'Error leaderboard with frequency + exact agent quote ("Agent said") per type'],
                ['Verified patches', 'Find → replace diff · line number confirmed against live prompt · copy buttons'],
                ['Apply Fix', 'One-click apply with pre-flight prompt verification · fires re-analysis on 15 calls after'],
                ['Worst calls panel', '8 most problematic calls with FP mark buttons'],
                ['Error Heatmap', '30-day calendar per error type — intensity = count that day'],
                ['Outcome Chart', '12-week stacked bar: success / no_answer / not_interested / incomplete / no_save'],
                ['Before/After', 'Date picker → per-error count change · use after applying a fix'],
                ['Prompt version chart', 'Error rate per SHA-256 prompt hash — shows drop after each fix'],
                ['Prompt viewer', 'Full live system prompt (collapsible)'],
              ].map(([s, d]) => (
                <tr key={s}><Td><span className="font-medium text-ink">{s}</span></Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>

          <H3 id="call-detail">Call Detail — <Code>/calls/[id]</Code></H3>
          <Table>
            <thead><tr><Th>Section</Th><Th>Content</Th></tr></thead>
            <tbody>
              {[
                ['Header', 'Call ID · Agent · Duration · Status · Date'],
                ['Audio player', 'Native <audio> controls — only renders if recording available from Ultravox'],
                ['Transcript', 'Chat-bubble view. Messages >300 chars collapse with ↓ show more toggle'],
                ['Error Analysis', 'Each error: type · severity · exact agent quote · what went wrong · better response'],
                ['Coaching notes', 'missed_opportunities from Haiku + audio coaching from Llama enrichment'],
                ['Goal outcome', 'goal_achieved boolean + goal_outcome string (success / incomplete / etc)'],
              ].map(([s, d]) => (
                <tr key={s}><Td><span className="font-medium text-ink">{s}</span></Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>

          <H3 id="cost-strip">Cost & Usage Strip</H3>
          <P>Appears below the AI Pipeline strip on <Code>/dashboard</Code>.</P>
          <ul className="text-[14px] text-ink-2 mb-4 space-y-1.5 pl-4">
            {[
              'Today / This week / All time cost tiles',
              'Per-agent-type horizontal bars (Sales / Debt / Cold Outreach)',
              'Avg cost per analysis + total analyses count',
              'Data source: llm_traces table, error_analysis purpose, costed traces only',
            ].map((t) => <li key={t} className="flex gap-2"><span className="text-accent shrink-0 mt-0.5">·</span>{t}</li>)}
          </ul>

          <hr className="border-border-subtle my-10" />

          {/* ── API ──────────────────────────────────────────────── */}
          <H2 id="api">REST API v1</H2>
          <P>Base URL: <Code>https://voxray.vercel.app/api/v1</Code></P>

          <H3 id="api-auth">Authentication</H3>
          <P>Optional. If <Code>VOXRAY_API_KEY</Code> env var is set, all requests require:</P>
          <Pre>{`X-API-Key: <your-api-key>`}</Pre>
          <P>Without the env var set, the API is open. Recommended to set it for production.</P>

          <H3 id="api-stats"><Code>GET /api/v1/stats</Code></H3>
          <P>Aggregate dashboard metrics across all calls.</P>
          <Pre>{`curl https://voxray.vercel.app/api/v1/stats`}</Pre>
          <Pre>{`{
  "total_calls": 1846,
  "ended_calls": 1820,
  "active_calls": 2,
  "success_rate_pct": 71,
  "total_cost_usd": 4.32,
  "avg_duration_seconds": 127,
  "total_analyzed": 858,
  "calls_with_errors": 472,
  "error_rate_pct": 55
}`}</Pre>

          <H3 id="api-errors"><Code>GET /api/v1/errors</Code></H3>
          <P>Error leaderboard ranked by frequency. Includes human-readable labels and prompt fix suggestions.</P>
          <Table>
            <thead><tr><Th>Param</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
            <tbody>
              <tr><Td mono>agent</Td><Td>string</Td><Td>—</Td><Td>Filter by agent name e.g. <Code>Sales AI</Code></Td></tr>
            </tbody>
          </Table>
          <Pre>{`curl "https://voxray.vercel.app/api/v1/errors?agent=Sales+AI"

{
  "total_analyzed": 858,
  "calls_with_errors": 472,
  "total": 21,
  "errors": [
    {
      "type": "accepted_garbled_audio",
      "human_label": "Accepted unclear audio as a valid answer",
      "count": 137,
      "critical_count": 0,
      "agents": ["Sales AI", "Cold Outreach"],
      "example_call_id": "abc123...",
      "fix_suggestion": "The GARBLED AUDIO RULE is already in the prompt..."
    }
  ],
  "worst_calls": [ ... ]
}`}</Pre>

          <H3 id="api-calls"><Code>GET /api/v1/calls</Code></H3>
          <P>Paginated call list.</P>
          <Table>
            <thead><tr><Th>Param</Th><Th>Type</Th><Th>Default</Th><Th>Description</Th></tr></thead>
            <tbody>
              {[
                ['page', 'number', '1', 'Page number'],
                ['limit', 'number', '50', 'Results per page (max 100)'],
                ['offset', 'number', '—', 'Cursor offset — overrides page'],
                ['agent', 'string', '—', 'Filter by agent name'],
                ['has_errors', 'boolean', '—', 'true = only calls with errors'],
                ['analysis_status', 'string', '—', 'complete | pending | error'],
              ].map(([p, t, d, desc]) => (
                <tr key={p}><Td mono>{p}</Td><Td>{t}</Td><Td>{d}</Td><Td>{desc}</Td></tr>
              ))}
            </tbody>
          </Table>
          <Pre>{`curl "https://voxray.vercel.app/api/v1/calls?agent=Debt+Collector&has_errors=true&limit=10"

{
  "calls": [
    {
      "call_id": "abc123...",
      "agent": "Debt Collector",
      "status": "ended",
      "ended_reason": "hangup",
      "duration_seconds": 143,
      "cost_usd": 0.014,
      "error_count": 2,
      "critical_error_count": 1,
      "analysis_status": "complete",
      "created_at": "2026-05-24T10:00:00Z"
    }
  ],
  "total": 323,
  "page": 1,
  "limit": 10,
  "has_more": true,
  "next_offset": 10
}`}</Pre>

          <H3 id="api-call-id"><Code>GET /api/v1/calls/:id</Code></H3>
          <P>Full call detail including transcript and error analysis.</P>
          <Pre>{`curl "https://voxray.vercel.app/api/v1/calls/abc123-4567-..."

{
  "call_id": "abc123...",
  "agent": "Sales AI",
  "analysis_status": "complete",
  "error_count": 2,
  "critical_error_count": 1,
  "analysis": {
    "goal_achieved": false,
    "goal_outcome": "incomplete",
    "summary": "Agent accepted garbled audio on location question...",
    "missed_opportunities": ["Did not confirm appointment time"],
    "errors": [
      {
        "type": "accepted_garbled_audio",
        "severity": "major",
        "agent_line": "Okay... so Kiira Road...",
        "what_went_wrong": "Customer response was noise...",
        "should_have_said": "I'm sorry, could you repeat that?",
        "timestamp_index": 7,
        "confidence": 0.92
      }
    ]
  },
  "messages": [
    { "role": "agent", "text": "Hello...", "ordinal": 0 }
  ]
}`}</Pre>

          <H3 id="api-export"><Code>GET /api/v1/export</Code></H3>
          <P>CSV export. Returns <Code>Content-Type: text/csv</Code> with download header.</P>
          <Table>
            <thead><tr><Th>Param</Th><Th>Value</Th><Th>Description</Th></tr></thead>
            <tbody>
              {[
                ['type', 'errors (default)', 'Error leaderboard as CSV'],
                ['type', 'calls', 'Full call list as CSV'],
                ['type', 'worst_calls', 'Top 50 worst calls as CSV'],
              ].map(([p, v, d]) => (
                <tr key={v}><Td mono>{p}</Td><Td mono>{v}</Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>
          <Pre>{`curl "https://voxray.vercel.app/api/v1/export?type=errors" -o errors.csv
curl "https://voxray.vercel.app/api/v1/export?type=calls"  -o calls.csv`}</Pre>

          <hr className="border-border-subtle my-10" />

          {/* ── MCP ──────────────────────────────────────────────── */}
          <H2 id="mcp">MCP Server</H2>
          <P>Voxray ships a Model Context Protocol server — connect it to Claude Desktop, Cursor, or any MCP-compatible client to query call data conversationally.</P>

          <H3 id="mcp-setup">Setup</H3>
          <P><strong className="text-ink">Option A — stdio</strong> (Claude Desktop / Cursor)</P>
          <P>Add to your MCP config (<Code>claude_desktop_config.json</Code> or <Code>.cursor/mcp.json</Code>):</P>
          <Pre>{`{
  "mcpServers": {
    "voxray": {
      "command": "npx",
      "args": ["tsx", "/path/to/voxray/voxray-mcp-server/src/index.ts"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "VOXRAY_URL": "https://voxray.vercel.app"
      }
    }
  }
}`}</Pre>
          <P><strong className="text-ink">Option B — HTTP transport</strong></P>
          <Pre>{`TRANSPORT=http PORT=3001 npx tsx voxray-mcp-server/src/index.ts`}</Pre>

          <H3 id="mcp-tools">Tools</H3>
          <P>All tools are read-only — no mutations to Ultravox or Supabase.</P>
          <Table>
            <thead><tr><Th>Tool</Th><Th>Description</Th><Th>Key input</Th></tr></thead>
            <tbody>
              {[
                ['voxray_get_stats', 'Aggregate metrics: total calls, error rate, cost, success rate', 'response_format'],
                ['voxray_get_agent_summary', 'Per-agent breakdown: error rates, call counts, top errors', 'response_format'],
                ['voxray_list_errors', 'Error leaderboard with fix suggestions, filterable by agent', 'agent, limit, include_fix'],
                ['voxray_list_calls', 'Paginated call list with filters', 'agent, page, has_errors, analysis_status'],
                ['voxray_get_call', 'Full call detail: transcript + error analysis', 'call_id, include_transcript'],
              ].map(([t, d, i]) => (
                <tr key={t}><Td mono>{t}</Td><Td>{d}</Td><Td mono>{i}</Td></tr>
              ))}
            </tbody>
          </Table>
          <P>All tools accept <Code>response_format: &quot;markdown&quot; | &quot;json&quot;</Code>. Markdown is default — readable in AI chat. JSON for programmatic use.</P>

          <div className="rounded-xl border border-border-subtle bg-surface-2 p-4 mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">Example prompts</div>
            <ul className="space-y-1.5">
              {[
                '"What is the current error rate?"',
                '"Which agent has the highest error rate?"',
                '"What are Debt Collector\'s most common mistakes?"',
                '"Show me the last 10 Sales AI calls with errors"',
                '"What happened in call abc123? Show me the transcript."',
                '"How do I fix the no_save_answers error?"',
              ].map((p) => (
                <li key={p} className="text-[13px] text-ink-2 flex gap-2">
                  <span className="text-accent shrink-0">→</span>
                  <span className="font-mono">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-border-subtle my-10" />

          {/* ── CLI ──────────────────────────────────────────────── */}
          <H2 id="cli">CLI</H2>
          <P>Run from the voxray project root. Requires <Code>.env.local</Code> with Supabase + Ultravox keys.</P>
          <Pre>{`npm run voxray <command> [options]
# or
npx tsx scripts/voxray-cli.ts <command> [options]`}</Pre>

          <H3 id="cli-stats"><Code>voxray stats</Code></H3>
          <P>Print dashboard metrics to terminal.</P>
          <Pre>{`npm run voxray stats

Voxray — Stats
────────────────────────────────────
Total Calls     1846
Active Now      2
Success Rate    71%
Total Cost      $4.32
Avg Duration    2m 7s
────────────────────────────────────
Analyzed        858 / 1846
Calls w/ Errors 472
Error Rate      55%`}</Pre>

          <H3 id="cli-errors"><Code>voxray errors</Code></H3>
          <P>Error leaderboard with fix suggestions.</P>
          <Pre>{`npm run voxray errors
npm run voxray errors --agent "Sales AI"
npm run voxray errors --agent "Debt Collector" --limit 5
npm run voxray errors --no-fix    # hide fix suggestion text`}</Pre>
          <Table>
            <thead><tr><Th>Flag</Th><Th>Description</Th></tr></thead>
            <tbody>
              {[
                ['-a, --agent <name>', 'Filter by agent name'],
                ['-l, --limit <n>', 'Max error types to show (default: 15)'],
                ['--no-fix', 'Hide fix suggestion text'],
              ].map(([f, d]) => (
                <tr key={f}><Td mono>{f}</Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>

          <H3 id="cli-calls"><Code>voxray calls</Code></H3>
          <P>Paginated call list.</P>
          <Pre>{`npm run voxray calls
npm run voxray calls --agent "Sales AI"
npm run voxray calls --errors-only
npm run voxray calls --page 2`}</Pre>
          <Table>
            <thead><tr><Th>Flag</Th><Th>Description</Th></tr></thead>
            <tbody>
              {[
                ['-a, --agent <name>', 'Filter by agent name'],
                ['-p, --page <n>', 'Page number (default: 1)'],
                ['--errors-only', 'Only show calls with detected errors'],
              ].map(([f, d]) => (
                <tr key={f}><Td mono>{f}</Td><Td>{d}</Td></tr>
              ))}
            </tbody>
          </Table>

          <H3 id="cli-call"><Code>voxray call &lt;id&gt;</Code></H3>
          <P>Full transcript + error analysis for one call.</P>
          <Pre>{`npm run voxray call abc123-4567-...
npm run voxray call abc123-4567-... --no-transcript  # errors only`}</Pre>
          <P>Output: call metadata · each error with exact agent quote · full transcript with role labels.</P>

          <H3 id="cli-analyze"><Code>voxray analyze &lt;id&gt;</Code></H3>
          <P>Run Claude Haiku analysis on a specific call immediately.</P>
          <Pre>{`npm run voxray analyze abc123-4567-...
npm run voxray analyze abc123-4567-... --force   # re-analyze even if already done`}</Pre>
          <P>Use for: analyzing a specific call without waiting for the daily cron, re-running after a prompt update to verify a fix worked.</P>

          <H3 id="cli-sync"><Code>voxray sync</Code></H3>
          <P>Pull latest calls from Ultravox and auto-analyze new ones.</P>
          <Pre>{`npm run voxray sync`}</Pre>
          <P>Calls <Code>POST /api/sync</Code> on the server defined by <Code>VOXRAY_URL</Code> in <Code>.env.local</Code>.</P>

          <H3 id="cli-monitor"><Code>voxray monitor</Code></H3>
          <P>Poll for new critical errors and print alerts to terminal.</P>
          <Pre>{`npm run voxray monitor
npm run voxray monitor --interval 30   # check every 30s (default: 60)`}</Pre>
          <P>Useful during active call hours to catch spikes before Telegram fires.</P>

          <hr className="border-border-subtle my-10" />

          {/* ── ALERTING ─────────────────────────────────────────── */}
          <H2 id="alerting">Alerting</H2>
          <P>Voxray sends Telegram alerts for two trigger types.</P>

          <H3 id="alerting-burst">Burst Alerts (6 rules)</H3>
          <Table>
            <thead><tr><Th>Rule</Th><Th>Trigger</Th></tr></thead>
            <tbody>
              {[
                ['High error rate', '>60% error rate across last 10 calls'],
                ['Critical spike', '3+ critical errors in last 10 calls'],
                ['No save spike', '5+ no_save_answers in last 20 calls'],
                ['Garbled audio spike', '5+ accepted_garbled_audio in last 20 calls'],
                ['Past date spike', '3+ accepted_past_date in last 20 calls'],
                ['Broke promise spike', '3+ broke_promise in last 20 calls'],
              ].map(([r, t]) => <tr key={r}><Td><span className="font-medium text-ink">{r}</span></Td><Td>{t}</Td></tr>)}
            </tbody>
          </Table>
          <P>Each alert fires once, suppressed for 2 hours. Acknowledge button on dashboard suppresses until next day.</P>

          <H3 id="alerting-repeat">Repeat Error Alerts</H3>
          <P>Fire after every call analysis if the same error has occurred 3+ times in 30 days for an agent.</P>
          <Table>
            <thead><tr><Th>Tier</Th><Th>Condition</Th></tr></thead>
            <tbody>
              {[
                ['FIX REGRESSION', 'Error recurred after a fix was applied — highest priority'],
                ['Apply now', 'Fix spec exists and find text verified in live prompt'],
                ['Write patch', 'No fix spec written for this error type yet'],
              ].map(([tier, cond]) => (
                <tr key={tier}><Td><Badge tone={tier === 'FIX REGRESSION' ? 'crit' : tier === 'Apply now' ? 'warn' : 'default'}>{tier}</Badge></Td><Td>{cond}</Td></tr>
              ))}
            </tbody>
          </Table>
          <P>All alerts include inline Telegram button linking directly to the agent profile page.</P>

          <hr className="border-border-subtle my-10" />

          {/* ── ERROR TYPES ──────────────────────────────────────── */}
          <H2 id="error-types">Error Types Reference</H2>
          <P>22 error types across 4 agent categories. Each call can have multiple errors.</P>
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Severity</Th>
                <Th>Description</Th>
                <Th>Agents</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ['accepted_garbled_audio', 'major', 'Unclear STT treated as valid answer', 'All'],
                ['accepted_unknown_location', 'critical', 'Non-existent area accepted as location answer', 'Sales'],
                ['accepted_past_date', 'critical', 'Appointment date in the past accepted', 'Sales, Debt'],
                ['accepted_vague_date', 'major', '"Soon" / "next week" accepted instead of exact date', 'Debt'],
                ['no_save_answers', 'critical', 'Call ended without saveAnswers tool call', 'Sales, Outreach, Inbound'],
                ['no_save_debt', 'critical', 'Call ended without saveDebt tool call', 'Debt'],
                ['stacked_questions', 'major', 'Multiple questions asked in one turn', 'Sales, Outreach, Inbound'],
                ['no_consultation', 'major', 'No value-add after collecting 3–4 answers', 'Sales'],
                ['broke_promise', 'critical', 'Agent promised something it cannot deliver', 'Sales, Inbound'],
                ['wrong_info', 'major', 'Incorrect property/price/company details stated', 'Sales, Inbound'],
                ['skipped_repeat_rule', 'major', 'Customer said "sorry?" but agent advanced instead of repeating', 'Sales, Debt'],
                ['wrong_opening', 'major', 'Used "Am I speaking with?" on a cold call', 'Cold Outreach'],
                ['restart_loop', 'major', 'Full greeting restarted after customer interrupted', 'Cold Outreach'],
                ['no_name_collected', 'major', 'Proceeded to questions without getting customer name', 'Cold Outreach'],
                ['wrong_person_handling', 'major', 'Wrong number not closed with WhatsApp redirect', 'Cold Outreach'],
                ['pushed_back', 'minor', 'Agent argued after customer said not interested', 'Cold Outreach'],
                ['calculated_balance', 'critical', 'Agent computed remaining balance (only read raw values allowed)', 'Debt'],
                ['invented_amount', 'critical', 'Stated amount not from context variables', 'Debt'],
                ['no_product_context', 'major', 'Stated amount before explaining what product it is for', 'Debt'],
                ['no_commitment', 'major', 'Call ended with no payment commitment or escalation', 'Debt'],
                ['spoke_luganda', 'major', 'Used Luganda instead of redirect script', 'Debt'],
                ['wrong_company_name', 'critical', 'Agent identified as wrong company name', 'Inbound'],
                ['wrong_agent_name', 'critical', 'Agent introduced with wrong name', 'Inbound'],
              ].map(([type, sev, desc, agents]) => (
                <tr key={type}>
                  <Td mono>{type}</Td>
                  <Td><Badge tone={sev === 'critical' ? 'crit' : sev === 'major' ? 'warn' : 'default'}>{sev}</Badge></Td>
                  <Td>{desc}</Td>
                  <Td><span className="text-ink-3 text-[11px]">{agents}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Callout tone="warn">
            <strong>Production safety:</strong> Voxray never mutates Ultravox agents automatically.
            Apply Fix requires manual confirmation, pre-flight prompt verification, and is limited to a hard allowlist of known agent UUIDs.
            Unknown UUIDs → 403.
          </Callout>

          <div className="mt-12 pb-16 text-center">
            <div className="text-[11px] text-ink-3">
              Voxray · Built for Uganda voice agents ·{' '}
              <Link href="/dashboard" className="text-accent hover:underline">Open dashboard →</Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
