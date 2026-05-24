# Voxray — Documentation

**Live:** https://voxray.vercel.app  
**Repo:** https://github.com/rushilbh27/voxray

Voxray is a call intelligence dashboard for Ultravox voice agents. It detects exact agent mistakes per call, surfaces error patterns, and generates verified prompt patches — replacing manual call review with automated AI evaluation.

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [REST API v1](#rest-api-v1)
3. [MCP Server](#mcp-server)
4. [CLI](#cli)
5. [Alerting](#alerting)
6. [Error Types Reference](#error-types-reference)

---

## Dashboard

### `/dashboard` — Agent Grid

Top-level view. All monitored agents sorted by call volume.

Each agent card shows:
- **Display name** and call volume
- **Error rate** with color tone (green < 40%, amber 40–60%, red > 60%)
- **Critical alert count** (red badge if > 0)
- **Sparkline** — 8-week error rate trend inline
- **Top error type** for the agent
- **Link** to full agent profile

Click any card to open the agent profile.

---

### `/dashboard/[agentId]` — Agent Profile

Full per-agent intelligence page. Sections:

#### Stat Strip
| Metric | Description |
|--------|-------------|
| Total calls | All calls synced from Ultravox for this agent |
| Analyzed | Calls processed by Claude Haiku |
| Error rate | calls with errors / analyzed |
| Calls with errors | Raw count |
| Critical | Calls with at least one critical-severity error |

#### Error Intelligence
- Error leaderboard ranked by frequency
- Each row: error type + count + severity + **"Agent said"** — exact transcript quote that triggered the flag
- Confidence score (0.0–1.0) from Haiku

#### Verified Patches
For each error type, if a patch exists for that agent's prompt:
- **Find** — exact text to locate in the system prompt (with confirmed line number)
- **Replace** — exact replacement text
- **Copy buttons** — one click to copy either side
- `✓ find text verified (line N)` — green badge if text is confirmed in live prompt
- `already fixed` — if find text is absent (patch was already applied)

**Apply Fix** — one-click apply button:
1. Pre-flight `verifyPatch()` runs — aborts if find text missing
2. Calls `PATCH` Ultravox API with replaced system prompt
3. Fires re-analysis of last 15 calls automatically (results visible ~60s later)

**Apply All Fixes** — applies every verified patch for the agent in sequence.

#### Worst Calls Panel
8 calls with highest error counts. Shows:
- Customer name (from Llama audio enrichment)
- Call date
- Error count
- Link to call detail
- False positive mark button (marks errors as FP for precision tracking)

#### Error Heatmap
30-day calendar grid per top-6 error type. Intensity = error count on that day. Identifies recurring patterns (e.g. errors spike on Mondays).

#### Outcome Chart
12-week stacked bar chart — breakdown of `goal_outcome` values:
- `success` / `no_answer` / `not_interested` / `incomplete` / `no_save` / `other`

Shows weekly trend in call outcomes over 3 months.

#### Before/After Comparison
Date picker → `?compare=YYYY-MM-DD`:
- Left: error counts BEFORE the date
- Right: error counts AFTER
- % change per error type

Use after applying a fix to confirm error rate dropped.

#### Prompt Version Chart
Error rate per SHA-256 hash of the system prompt. Each time the prompt changes, a new hash appears. Shows whether fixes actually reduced errors.

#### Prompt Viewer
Full live system prompt from Ultravox (collapsible). Pulled fresh from the API on page load.

---

### `/calls/[id]` — Call Detail

| Section | Content |
|---------|---------|
| **Header** | Call ID · Agent · Duration · Status · Date |
| **Audio player** | Native `<audio>` player if recording available from Ultravox |
| **Transcript** | Chat-bubble view. Messages >300 chars collapse with `↓ show more` |
| **Error Analysis** | Each flagged error: type · severity · exact agent quote · what went wrong · what should have been said |
| **Coaching Notes** | `missed_opportunities` from Haiku + `missed_opportunities` from Llama audio |
| **Goal outcome** | `goal_achieved` boolean + `goal_outcome` string |

---

### Cost & Usage Strip

Below the AI Pipeline strip on `/dashboard`:
- **Today** — cost of all error-analysis Haiku calls since midnight
- **This week** — last 7 days
- **All time** — all costed traces in DB
- **Per-agent bars** — horizontal CSS bars showing relative cost split by agent type (Sales / Debt / Cold Outreach)
- **Avg cost per analysis** — total / analyses count

---

### AI Pipeline Strip

| Metric | Description |
|--------|-------------|
| p50 | Median Haiku analysis latency |
| p95 | 95th percentile latency |
| Cost today | Total Haiku cost in last 24h |
| Success 7d | % of analyses that returned valid JSON |
| Analyses 24h | Raw count of traces |

---

## REST API v1

Base URL: `https://voxray.vercel.app/api/v1`

Authentication: `X-API-Key: <VOXRAY_API_KEY>` header (optional — only if `VOXRAY_API_KEY` env var is set).

---

### `GET /api/v1/stats`

Aggregate dashboard metrics.

**Response:**
```json
{
  "total_calls": 1846,
  "ended_calls": 1820,
  "active_calls": 2,
  "success_rate_pct": 71,
  "total_cost_usd": 4.32,
  "avg_duration_seconds": 127,
  "total_analyzed": 858,
  "calls_with_errors": 472,
  "error_rate_pct": 55
}
```

---

### `GET /api/v1/errors`

Error leaderboard ranked by frequency. Includes human-readable labels and actionable fix suggestions.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `agent` | string | — | Filter by agent name (e.g. `Sales AI`, `Debt Collector`) |

**Response:**
```json
{
  "total_analyzed": 858,
  "calls_with_errors": 472,
  "total": 21,
  "count": 21,
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
  "worst_calls": [
    {
      "call_id": "abc123...",
      "agent": "Sales AI",
      "error_count": 5,
      "critical_error_count": 2,
      "summary": "Agent accepted garbled audio...",
      "goal_achieved": false,
      "created_at": "2026-05-24T10:00:00Z"
    }
  ]
}
```

---

### `GET /api/v1/calls`

Paginated call list.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page (max 100) |
| `offset` | number | — | Cursor offset (overrides `page`) |
| `agent` | string | — | Filter by agent name |
| `has_errors` | boolean | — | `true` = only calls with errors |
| `analysis_status` | string | — | `complete`, `pending`, `error` |

**Response:**
```json
{
  "calls": [
    {
      "call_id": "abc123...",
      "agent": "Sales AI",
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
  "total": 1846,
  "page": 1,
  "limit": 50,
  "pages": 37,
  "has_more": true,
  "next_offset": 50
}
```

---

### `GET /api/v1/calls/:id`

Full call detail including transcript and error analysis.

**Response:**
```json
{
  "call_id": "abc123...",
  "agent": "Sales AI",
  "status": "ended",
  "ended_reason": "hangup",
  "duration_seconds": 143,
  "cost_usd": 0.014,
  "created_at": "2026-05-24T10:00:00Z",
  "ended_at": "2026-05-24T10:02:23Z",
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
    { "role": "agent", "text": "Hello...", "ordinal": 0 },
    { "role": "user",  "text": "Hi there", "ordinal": 1 }
  ]
}
```

---

### `GET /api/v1/export`

CSV export.

**Query params:**

| Param | Value | Description |
|-------|-------|-------------|
| `type` | `errors` (default) | Error leaderboard as CSV |
| `type` | `calls` | Call list as CSV |
| `type` | `worst_calls` | Top 50 worst calls as CSV |

Returns `Content-Type: text/csv` with `Content-Disposition: attachment`.

**Example:**
```
GET /api/v1/export?type=errors
GET /api/v1/export?type=calls
GET /api/v1/export?type=worst_calls
```

---

## MCP Server

Voxray ships an MCP (Model Context Protocol) server. Connect it to Claude Desktop, Cursor, or any MCP-compatible AI client to query call data conversationally.

### Setup

**Option A — stdio (Claude Desktop / Cursor)**

Add to your MCP config (`claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
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
}
```

**Option B — HTTP transport**

```bash
TRANSPORT=http PORT=3001 npx tsx voxray-mcp-server/src/index.ts
```

Then configure your client to connect to `http://localhost:3001`.

---

### MCP Tools

All tools are **read-only** (no mutations to Ultravox or Supabase).

#### `voxray_get_stats`
Get aggregate dashboard metrics.

**Input:**
```json
{ "response_format": "markdown" }
```
`response_format`: `"markdown"` (default) or `"json"`

**Example prompts:**
- *"What is the current error rate?"*
- *"How much have we spent on Ultravox calls?"*
- *"How many calls have been analyzed?"*

---

#### `voxray_get_agent_summary`
Per-agent breakdown — error rates, call counts, top error types.

**Input:**
```json
{ "response_format": "markdown" }
```

**Example prompts:**
- *"Which agent has the highest error rate?"*
- *"What are Debt Collector's most common mistakes?"*
- *"Compare Sales AI vs Cold Outreach error rates"*

---

#### `voxray_list_errors`
Error leaderboard with fix suggestions, optionally filtered by agent.

**Input:**
```json
{
  "agent": "Sales AI",
  "limit": 20,
  "offset": 0,
  "include_fix": true,
  "response_format": "markdown"
}
```

All fields optional. `agent` filters to one agent's errors only.

**Example prompts:**
- *"What are the most common agent mistakes?"*
- *"What errors does the Debt Collector make?"*
- *"How do I fix the no_save_answers error?"*

---

#### `voxray_get_call` / `voxray_list_calls`
Retrieve individual call detail or paginated list.

**`voxray_list_calls` input:**
```json
{
  "agent": "Sales AI",
  "page": 1,
  "limit": 20,
  "has_errors": true,
  "analysis_status": "complete",
  "response_format": "markdown"
}
```

**`voxray_get_call` input:**
```json
{
  "call_id": "abc123-...",
  "include_transcript": true,
  "response_format": "markdown"
}
```

**Example prompts:**
- *"Show me the last 10 Sales AI calls with errors"*
- *"What happened in call abc123?"*
- *"Show me the full transcript for the worst call today"*

---

## CLI

Run from the voxray project root. Requires `.env.local` with Supabase + Ultravox keys.

```bash
npm run voxray <command> [options]
# or
npx tsx scripts/voxray-cli.ts <command> [options]
```

---

### `voxray stats`

Print dashboard metrics to terminal.

```bash
npm run voxray stats
```

**Output:**
```
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
Error Rate      55%
```

---

### `voxray errors`

Error leaderboard with fix suggestions.

```bash
npm run voxray errors
npm run voxray errors --agent "Sales AI"
npm run voxray errors --agent "Debt Collector" --limit 5
npm run voxray errors --no-fix      # hide fix suggestions
```

**Options:**

| Flag | Description |
|------|-------------|
| `-a, --agent <name>` | Filter by agent name |
| `-l, --limit <n>` | Max error types to show (default: 15) |
| `--no-fix` | Hide fix suggestion text |

---

### `voxray calls`

Paginated call list.

```bash
npm run voxray calls
npm run voxray calls --agent "Sales AI"
npm run voxray calls --errors-only
npm run voxray calls --page 2
```

**Options:**

| Flag | Description |
|------|-------------|
| `-a, --agent <name>` | Filter by agent name |
| `-p, --page <n>` | Page number (default: 1) |
| `--errors-only` | Only show calls with detected errors |

---

### `voxray call <id>`

Full transcript + error analysis for one call.

```bash
npm run voxray call abc123-4567-...
npm run voxray call abc123-4567-... --no-transcript  # skip transcript, show errors only
```

**Output includes:**
- Call metadata (agent, duration, date, goal outcome)
- Each error: type · severity · exact agent quote · what went wrong · what should have been said
- Full transcript with role labels (Agent / User / Tool)

---

### `voxray analyze <id>`

Run Claude Haiku analysis on a specific call.

```bash
npm run voxray analyze abc123-4567-...
npm run voxray analyze abc123-4567-... --force   # re-analyze even if already done
```

Useful for:
- Analyzing a specific call without waiting for the cron
- Re-running analysis after a prompt update to verify fix worked
- Testing analysis on a known-bad call

---

### `voxray sync`

Pull latest calls from Ultravox and auto-analyze any unanalyzed ones.

```bash
npm run voxray sync
```

Calls `POST /api/sync` on the running server (local or production depending on `VOXRAY_URL`).

---

### `voxray monitor`

Poll for new critical errors and print alerts to terminal.

```bash
npm run voxray monitor
npm run voxray monitor --interval 30   # check every 30s (default: 60)
```

**Options:**

| Flag | Description |
|------|-------------|
| `--interval <seconds>` | Polling interval (default: 60) |

Continuously checks for new critical errors. Useful during active call hours to catch spikes before Telegram alert fires.

---

## Alerting

Voxray sends Telegram alerts for two trigger types:

### Burst Alerts (6 rules)
Fire when a threshold is crossed across recent calls:

| Rule | Trigger |
|------|---------|
| High error rate | >60% error rate across last 10 calls |
| Critical spike | 3+ critical errors in last 10 calls |
| No save spike | 5+ `no_save_answers` in last 20 calls |
| Garbled audio spike | 5+ `accepted_garbled_audio` in last 20 calls |
| Past date spike | 3+ `accepted_past_date` in last 20 calls |
| Broke promise spike | 3+ `broke_promise` in last 20 calls |

Each alert fires once, then is suppressed for 2 hours. Dashboard shows active alerts with **Acknowledge** button to suppress until next day.

### Repeat Error Alerts
Fire after every call analysis if the same error type has occurred 3+ times in 30 days for an agent:

| Tier | Condition | Alert message |
|------|-----------|--------------|
| **FIX REGRESSION** | Error recurred after a fix was applied | Highest priority |
| **Apply now** | Fix spec exists and is verified | Includes apply link |
| **Write patch** | No fix spec written yet | Prompts action |

All alerts include inline Telegram button linking directly to the agent profile page.

---

## Error Types Reference

| Error Type | Severity | Description | Agents |
|-----------|----------|-------------|--------|
| `accepted_garbled_audio` | major | Unclear STT treated as valid answer | Sales, Debt, Cold Outreach, Inbound |
| `accepted_unknown_location` | critical | Non-existent/unclear area accepted as location answer | Sales |
| `accepted_past_date` | critical | Appointment/callback date in the past accepted | Sales, Debt |
| `accepted_vague_date` | major | "Soon" / "next week" accepted instead of exact date | Debt |
| `no_save_answers` | critical | Call ended without `saveAnswers` tool call | Sales, Cold Outreach, Inbound |
| `no_save_debt` | critical | Call ended without `saveDebt` tool call | Debt |
| `stacked_questions` | major | Multiple questions asked in one turn | Sales, Cold Outreach, Inbound |
| `no_consultation` | major | No value-add after collecting 3–4 answers | Sales |
| `broke_promise` | critical | Agent promised something it cannot deliver | Sales, Edifice |
| `wrong_info` | major | Incorrect property/price/company details stated | Sales, Inbound |
| `skipped_repeat_rule` | major | Customer said "sorry?" but agent advanced instead of repeating | Sales, Debt |
| `wrong_opening` | major | Used "Am I speaking with?" on a cold call | Cold Outreach |
| `restart_loop` | major | Full greeting restarted after customer interrupted | Cold Outreach |
| `no_name_collected` | major | Proceeded to questions without getting customer name | Cold Outreach |
| `wrong_person_handling` | major | Wrong number not handled with WhatsApp redirect | Cold Outreach |
| `pushed_back` | minor | Agent argued after customer said not interested | Cold Outreach |
| `calculated_balance` | critical | Agent computed remaining balance (only read raw values allowed) | Debt |
| `invented_amount` | critical | Stated amount not from context variables | Debt |
| `no_product_context` | major | Stated amount before explaining what product it's for | Debt |
| `no_commitment` | major | Call ended with no payment commitment or escalation | Debt |
| `spoke_luganda` | major | Used Luganda instead of redirect script | Debt |
| `wrong_company_name` | critical | Agent identified as wrong company name | Inbound (NECTOR Demo) |
| `wrong_agent_name` | critical | Agent introduced with wrong name | Inbound (NECTOR Demo) |
| `wrong_call_type` | major | Executed wrong call flow (outbound vs. inbound) | Sales (legacy) |

---

## Agent Types

Voxray classifies each agent call into one of 4 analysis modes:

| Type | Agents | Key rules enforced |
|------|--------|--------------------|
| `sales` | Sales AI, Real Estate AI | Outbound sales flow, appointment booking, location validation, consultation value-add |
| `debt` | Debt Collector, Debt Collection 2, Debt Welcome Bot | Product-before-amount, exact date, no balance calculation, Luganda redirect |
| `cold_outreach` | Cold Outreach AI, Follow-Up Debt Bot | Cold opening format, no restart, name before questions, WhatsApp redirect |
| `inbound` | Ramco Gas, Edifice Properties, Davansh Investment, NECTOR Demo, UCC | Correct company/agent identity, single questions, no invented info |

When an agent's `agentId` is available in the DB, Voxray fetches the **live system prompt** from Ultravox and sends it directly to Haiku — overriding the static rules above. Static rules are the fallback only.

---

## Production Safety

**NEVER POST/PATCH/DELETE to `api.ultravox.ai`.**  
Live Uganda customers. ~100 calls/day. GET only.

The one exception: `POST /api/agents/[agentId]/apply-fix` applies a prompt patch via Ultravox PATCH API. This is:
- Hard allowlisted to 11 known agent UUIDs (unknown UUIDs → 403)
- Auth-gated (requires Supabase session)
- Pre-flight verified (`verifyPatch()` runs before any write)
- Manual only — no auto-apply anywhere in the codebase
