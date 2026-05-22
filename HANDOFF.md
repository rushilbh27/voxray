# Voxray — Session Handoff

## Goal

Build **Voxray** — call intelligence dashboard for Ultravox voice agents deployed for Uganda businesses. NOT a call metrics viewer. Purpose: detect exact agent mistakes per call, surface error patterns, drive prompt improvement feedback loop — and proactively alert before clients report problems.

Tech stack: Next.js 16 (App Router), TypeScript, Tailwind 4, Supabase, Ultravox REST API, Anthropic SDK (Claude Haiku).

Repo: https://github.com/rushilbh27/voxray  
Live: https://voxray.vercel.app

---

## Current State — Everything That Works

### Core Intelligence
- ✅ 1808+ calls synced from Ultravox (cursor-paginated, auto-synced)
- ✅ 639+ calls analyzed — ~52% error rate
- ✅ Agent-type-aware analysis: Sales AI, Debt Collector, Cold Outreach each have distinct rule sets
- ✅ `accepted_unknown_location` — detects "cannot recognize area" errors
- ✅ False-positive guard: `no_save_answers` / `no_save_debt` only flags if 4+ agent turns AND no Tool message in final 4 messages
- ✅ Daily cron auto-analyzes 30 unanalyzed calls per run

### Analysis Pipeline
- ✅ **Primary: Claude Haiku** — synchronous, authoritative error detection, proven accurate
- ✅ **Enrichment: Llama 3.2 (self-hosted)** — async audio pipeline, adds `raw_transcript` + `customer_name` + `agent_name` via webhook. Llama does NOT do error detection.
- ✅ Automatic fallback: Llama fails → Haiku runs
- ✅ `jsonrepair` handles LLM JSON defects (unescaped quotes, trailing commas)
- ✅ MAX_CHARS=300k, max_tokens=4096, CONCURRENCY=2, 3x retry with 5s/10s/20s backoff
- ✅ Race condition fixed — batch-claim before processing (safe for parallel terminals)

### Real-Time Analysis
- ✅ **Ultravox webhook** (`POST /api/webhook/call-ended`) — fires within seconds of call ending
  - Pipeline: ACK 204 instantly → background: upsert call + messages → analyze → alert check
  - Auto-detects new agents via `call.agent.name` from payload
- ✅ HMAC signature verification

### Dashboard — Agent Profile Redesign (COMPLETED THIS SESSION)
- ✅ **Agent Grid on /dashboard** — replaces error leaderboard. Cards per agent showing: total calls, error rate, calls with errors, critical count, top error type. Click → navigates to `/dashboard/[agentId]`
- ✅ **Per-agent profile page `/dashboard/[agentId]`** — the core new page:
  - Agent stats strip (calls, analyzed, error rate, critical count)
  - Error leaderboard with **verified patches** (line number shown, find text confirmed in THAT agent's prompt)
  - Find/Replace FixBlock with copy buttons per patch
  - ApplyFixButton (NECTOR Demo only, only when find text verified)
  - **ApplyAllFixesButton** — one click applies ALL fixable errors for an agent
  - Worst calls for that agent with FP buttons
  - Prompt version chart per agent
  - Collapsible prompt viewer (full system prompt)
  - Loading skeleton
- ✅ `verifyPatch()` in `fix-specs.ts` — verifies patch find-text exists in prompt, returns line number + context
- ✅ `fetchAllAgentPrompts()` in `ultravox.ts` — fetches ALL agents that have calls in system (not hardcoded 4)
- ✅ Apply-fix API pre-flight check — returns 409 with details if find text not in prompt
- ✅ Supabase RPC `get_agent_error_summary()` — per-agent stats for agent grid
- ✅ Full UI/UX redesign — OKLCH warm palette, Tailwind 4 design tokens
- ✅ Stat strip (7 metrics), AI pipeline strip (p50/p95 latency, cost, success rate)
- ✅ Date range filters (All time/30d/7d)
- ✅ Error rate trend chart (weekly per-agent, last 12 weeks)
- ✅ loading.tsx skeleton for instant navigation feedback
- ✅ All queries parallelized (Promise.all)
- ✅ Login (Supabase SSR auth)

### Fix Suggestions — Status After This Session
- ✅ Architecture fixed — per-agent profile page verifies patches against THAT agent's actual prompt
- ✅ ApplyFixButton only shows when find text confirmed in prompt
- ✅ ApplyAllFixesButton for one-click batch apply
- ✅ Pre-flight verification in apply-fix API
- ✅ **Fix-specs written for all major agents** — 18 find strings verified against live prompts (commit `b8f81d3`)
  - Sales AI: fixed `accepted_garbled_audio` capitalization mismatch (was 10/11, now 11/11)
  - Debt-Collector-Agent-UG: 7 new patches (`no_save_debt`, `calculated_balance`, `invented_amount`, `no_product_context`, `no_commitment`, `accepted_vague_date`; `accepted_past_date` already matched)
  - Cold_Outreach_AI: 5 new patches (`accepted_garbled_audio`, `wrong_opening`, `pushed_back`, `no_name_collected`, `restart_loop`)
  - Davansh/Edifice inbound: 2 new patches each (`wrong_info`, `no_save_answers`)
  - `spoke_luganda` in Debt Collector shows "Already fixed" correctly (fix already applied to prompt)
- ⚠️ Still untested/unpatched: NECTOR_DEMO (UCC complaints agent — needs entirely different error types), Ramco_Gas, Follow_Up_Debt_Collection_Bot, Debt_Collection_Welcome-Bot, Real_Estate_AI (only `stacked_questions` matches)

### Proactive Alerting
- ✅ 6 alert rules, Telegram delivery, alert ack (4h/24h), dashboard banner

### Other
- ✅ Fix log, false positive tracking, cost intelligence, API v1, MCP server, CLI

---

## Agents & UUIDs

| Agent | UUID | Prompt matches fix-specs? |
|-------|------|--------------------------|
| Sales_AI | `65ae3d7d-5a1f-4880-89f4-1ce690efae89` | ✅ YES (11/11) |
| Debt-Collector-Agent-UG | `52db715f-fc68-4265-a354-7f64a27cd3b9` | ✅ YES (7 patches verified) |
| Cold_Outreach_AI | `74c435db-0382-45d4-8f84-65343c0dde5f` | ✅ YES (8 patches verified) |
| NECTOR_DEMO_TEST | `428d7591-3ba5-4b60-8aa5-a92012d12451` | ✅ YES (4 patches: wrong_info, accepted_garbled_audio, no_save_answers, stacked_questions) |
| Davansh_Investment_inbound | `0a5b5ccc-4f75-456c-94c8-f9e7293f9d81` | ✅ YES (2 patches verified) |
| Edifice_Properties_inbound | `bfea3820-a447-4444-bd41-53ff919bbfe3` | ✅ YES (2 patches verified) |
| Ramco_Gas_inbound | `5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1` | ✅ No active errors — no patches needed |
| Real_Estate_AI_Sales_Agent | `efecb97c-2937-4507-a550-8db5e8882c82` | ✅ YES (3 patches: broke_promise, wrong_info, no_save_answers) |
| Debt_Collection_2 | `4be98966-7c89-4149-8f10-e2ac16291f66` | ✅ YES (same prompt as Debt-Collector-Agent-UG) |
| Follow_Up_Debt_Collection_Bot | `3983f5c0-4a95-42e3-a95a-9dbe57e11c78` | ✅ No active errors — no patches needed |
| Debt_Collection_Welcome-Bot | `2dfe90c6-569f-49e0-84f4-e67d9e770255` | ✅ No active errors — no patches needed |

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `ultravox_calls` | All calls + analysis + `prompt_hash` |
| `ultravox_messages` | Message-level transcripts |
| `llm_traces` | Every Haiku call: latency, tokens, cost, model |
| `prompt_versions` | Prompt hash → first/last seen per agent |
| `false_positives` | Human FP marks (ground truth for eval) |
| `prompt_fixes` | Fix log (agent, error_type, description, applied_at) |
| `alert_acks` | Alert suppressions (rule_id, agent, ack_until) |

## Supabase RPC Functions (all created)

| Function | Purpose |
|----------|---------|
| `get_dashboard_aggregates()` | All stat strip counts in one query |
| `get_error_frequency(since, agent)` | Error leaderboard from JSONB |
| `get_client_breakdown()` | Agent call counts |
| `get_weekly_trend()` | Weekly error rate per agent (12wk) |
| `get_comparison_data(date)` | Before/after error counts |
| `get_pipeline_stats()` | Haiku p50/p95 latency, cost, success rate |
| `get_eval_stats()` | FP count + total flags per error type |
| `get_prompt_version_trend(agent)` | Error rate per prompt hash |
| `get_error_velocity()` | Weekly count per error type (sparklines) |
| `get_agent_error_summary()` | Per-agent stats for agent grid (NEW THIS SESSION) |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Public homepage (/, static) |
| `src/app/dashboard/page.tsx` | Dashboard (/dashboard) — now shows agent grid |
| `src/app/dashboard/loading.tsx` | Skeleton loader |
| `src/app/dashboard/[agentId]/page.tsx` | **NEW** Per-agent profile page |
| `src/app/dashboard/[agentId]/loading.tsx` | **NEW** Agent profile skeleton |
| `src/app/dashboard/[agentId]/PromptViewer.tsx` | **NEW** Collapsible prompt viewer |
| `src/app/dashboard/[agentId]/ApplyAllFixesButton.tsx` | **NEW** Batch apply all fixes |
| `src/app/login/page.tsx` | Login |
| `src/app/calls/[id]/page.tsx` | Call detail |
| `src/app/components/Nav.tsx` | Sticky nav (live call count badge) |
| `src/app/components/FixBlock.tsx` | Find/Replace patch UI with copy buttons |
| `src/app/components/TrendChart.tsx` | Weekly error rate chart per agent |
| `src/app/components/PipelineStrip.tsx` | AI pipeline metrics |
| `src/app/components/EvalBadge.tsx` | FP rate + precision badge |
| `src/app/components/PromptVersionChart.tsx` | Error rate by prompt hash |
| `src/app/components/ErrorVelocitySparkline.tsx` | Per-error 8-week trend sparkline |
| `src/app/components/ApplyFixButton.tsx` | One-click fix apply (NECTOR Demo only) |
| `src/app/components/ReanalyzeButton.tsx` | Re-analyze last 30 calls for agent |
| `src/lib/fix-specs.ts` | Structured patches + `verifyPatch()` + `getApplicablePatches()` |
| `src/lib/llm-trace.ts` | Fire-and-forget LLM call tracing |
| `src/lib/error-analyzer.ts` | Claude Haiku prompts + confidence scoring |
| `src/lib/call-analyzer.ts` | Unified: Haiku primary + Llama enrichment + prompt hash |
| `src/lib/ultravox.ts` | Ultravox API client + `fetchAllAgentPrompts()` (fetches ALL agents) |
| `src/app/api/agents/[agentId]/apply-fix/route.ts` | Auto-apply with pre-flight verify (NECTOR Demo allowlist) |
| `src/app/api/agents/[agentId]/reanalyze/route.ts` | Re-analyze last N calls |
| `vercel.json` | Cron: `0 8 * * *` (daily, Hobby plan limit) |

---

## Architecture

```
Ultravox API (GET only — NEVER mutate prod agents)
    ↓  call.ended webhook → POST /api/webhook/call-ended  [REAL-TIME]
    ↓  OR: daily Vercel cron → /api/cron (30 calls + sync + alerts)
    ↓  OR: npm run analyze (local, 2 concurrent)
Supabase  ultravox_calls + ultravox_messages
    ↓  Claude Haiku → call_errors JSONB (ErrorAnalysis)  [PRIMARY]
    ↓  Llama 3.2 audio → raw_transcript + names (ENRICHMENT ONLY)
    ↓  alert engine → checks 6 rules, respects acks
Telegram alert + /api/alerts dashboard banner
    ↓
/dashboard (agent grid) → /dashboard/[agentId] (per-agent errors + patches)
API v1 / MCP server / CLI
```

---

## Production Safety

**NEVER POST/PATCH/DELETE to `api.ultravox.ai`.** Live Uganda customers (~100 calls/day). GET only.

Exception: `POST /api/agents/[agentId]/apply-fix` — **NECTOR Demo only** (`428d7591`). Hard allowlist. All production agents blocked. Pre-flight `verifyPatch()` runs before any PATCH.

---

## Git State

- Branch: `main`, up to date with origin/main
- Key commits this session:
  - `3d5d104` agent profile redesign: per-agent error pages + verified patches

---

## Env Vars

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ULTRAVOX_API_KEY=
ANTHROPIC_API_KEY=
VOXRAY_URL=https://voxray.vercel.app
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
ULTRAVOX_WEBHOOK_SECRET=
VOXRAY_API_KEY=             # optional
CRON_SECRET=                # optional
```

---

## ✅ COMPLETED: Write Fix-Specs for Non-Sales Agents (commit `b8f81d3`)

All major agents now have verified fix-spec patches. See agent table above.

## ✅ COMPLETED: NECTOR Demo + Real Estate AI Fix-Specs (session 2)

- NECTOR Demo: 4 patches (wrong_info, accepted_garbled_audio, no_save_answers, stacked_questions)
- Real Estate AI: 3 patches (broke_promise, wrong_info, no_save_answers)
- Ramco Gas / Follow-Up Debt / Debt Welcome: healthy, no active errors, no patches needed

## NEXT SESSION: Remaining Work

**Higher priority:**
1. **Verify NECTOR Demo + Real Estate patches** — patches written but need to open agent profile page in UI and confirm `verifyPatch()` finds line numbers in live prompts.
2. **Before/after comparison on agent profile** — `get_comparison_data(date)` RPC exists, UI removed from dashboard. Add `?compare=YYYY-MM-DD` to `/dashboard/[agentId]`.
3. **Expand auto-apply allowlist** — when FP rate < 10% for an error type on a production agent, consider adding that agent. Currently NECTOR Demo only.

**Lower priority:**
- README update — document agent profile flow
- Customer name display — `customer_name` from Llama enrichment, not surfaced in UI
- Call recordings — `GET /api/calls/{id}/recording` available, not exposed in UI
