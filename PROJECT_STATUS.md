# Voxray — Project Status Report

> Last updated: 2026-05-23 (session 4 — UI/UX pass: dark mode + animations + display names)  
> Update this file every session. Not a handoff bridge — a permanent record of what was built, where we stand, and where we're going.

---

## What Voxray Is

Call intelligence dashboard for Ultravox voice agents deployed for Uganda businesses. Not a metrics viewer.

**Core purpose:** Detect exact agent mistakes per call → surface error patterns → suggest prompt fixes → close the feedback loop before clients report problems.

**Live:** https://voxray.vercel.app  
**Repo:** https://github.com/rushilbh27/voxray

---

## The Ideal System (End State)

When Voxray is fully built, this is how it works end-to-end:

```
Call ends on Ultravox
    ↓  webhook fires within seconds
Voxray analyzes with Claude Haiku → detects exact errors
    ↓
Per-agent profile page shows:
  - Every error type the agent made (count, trend, precision)
  - Exact transcript quote showing WHAT the agent said
  - Prompt patch: find/replace with verified line number
  - Apply Fix button (with pre-flight verification)
    ↓
Operator applies patch → Ultravox prompt updates
    ↓
Voxray re-analyzes recent calls → shows error rate drop by prompt version
    ↓
Proactive alerts catch spikes before client sees them
    ↓
Feedback loop: every fix has before/after proof
```

**The ideal system has zero manual review.** An operator spends 5 minutes a day: reviews top errors, applies verified patches, watches error rate fall. No call listening required.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind 4 + OKLCH design tokens |
| Database | Supabase (Postgres) |
| AI — Error Detection | Claude Haiku 4.5 (primary, authoritative) |
| AI — Transcript Enrichment | Llama 3.2 self-hosted (audio → names, no error detection) |
| Voice Platform | Ultravox (GET only — never mutate prod) |
| Alerts | Telegram Bot API |
| Deployment | Vercel (Hobby plan — daily cron limit) |

---

## Agents in System

| Agent | UUID | Type | Fix-specs status |
|-------|------|------|-----------------|
| Sales_AI | `65ae3d7d` | Outbound sales | ✅ 11/11 patches verified |
| Debt-Collector-Agent-UG | `52db715f` | Debt collection | ✅ 7 patches verified |
| Debt_Collection_2 | `4be98966` | Debt collection | ✅ Same prompt as above |
| Cold_Outreach_AI | `74c435db` | Cold outreach | ✅ 8 patches verified |
| Davansh_Investment_inbound | `0a5b5ccc` | Inbound receptionist | ✅ 2 patches verified |
| Edifice_Properties_inbound | `bfea3820` | Inbound receptionist | ✅ 2 patches verified |
| NECTOR_DEMO_TEST | `428d7591` | UCC complaints demo | ✅ 4 patches verified (wrong_info, accepted_garbled_audio, no_save_answers, stacked_questions) |
| Real_Estate_AI_Sales_Agent | `efecb97c` | Outbound sales | ✅ 3 patches verified (broke_promise, wrong_info, no_save_answers) |
| Ramco_Gas_inbound | `5da7bc3e` | Inbound receptionist | ✅ No active errors in Supabase — no patches needed |
| Follow_Up_Debt_Collection_Bot | `3983f5c0` | Debt follow-up | ✅ No active errors in Supabase — no patches needed |
| Debt_Collection_Welcome-Bot | `2dfe90c6` | Debt welcome | ✅ No active errors in Supabase — no patches needed |

**Apply-fix allowlist:** NECTOR Demo only. All other agents: patches show as suggestions, apply button never appears, API returns 403.

---

## Data Volume (as of last check)

- **1,808+ calls** synced from Ultravox
- **639+ calls analyzed** — ~52% error rate
- **11 agents** monitored
- **~100 calls/day** from live Uganda clients

---

## What Has Been Built — Full History

### Phase 1 — Foundation (`758f8a9` → `d0b3b73`)
- Initial scaffold: Next.js + Supabase + Ultravox sync
- Call detail page + transcript view
- 1803 calls synced, pagination, client name detection

### Phase 2 — Error Detection (`7fdbe4b` → `4073d52`)
- Claude Haiku error detection per call (`call_errors` JSONB)
- Error dashboard with leaderboard
- Unified dashboard, MCP server, CLI, API v1 (`GET /api/v1/stats`, `/errors`, `/calls`, `/export`)
- Auth: Supabase SSR login, protected dashboard

### Phase 3 — Fix Suggestions + Observability (`83520fb` → `a188985`)
- Structured Find→Replace fix specs with copy buttons
- Live prompt check: patches show "already fixed" if find text missing
- Proactive alert engine: 6 rules, Telegram delivery
- Trend chart (12-week weekly error rate per agent)
- CSV export, eval framework (precision per error type)
- False positive tracking with FP buttons per call

### Phase 4 — Pipeline Reliability (`ab0fe03` → `f1786a7`)
- 429 retry with 3x backoff (5s/10s/20s)
- Concurrency reduced 5→2 for rate limits
- `jsonrepair` for malformed LLM JSON
- Batch-claim before processing → race condition fixed (parallel terminals safe)
- `max_tokens` 2048→4096

### Phase 5 — Real-Time + Llama Enrichment (`3a0901a` → `f490117`)
- Ultravox webhook (`POST /api/webhook/call-ended`) — fires within seconds
  - HMAC-SHA256 signature verification
  - ACK 204 instantly → background pipeline
  - Auto-detects new agents from webhook payload
- Llama 3.2 audio pipeline: `raw_transcript`, `customer_name`, `agent_name` via webhook
- Haiku primary + Llama enrichment-only architecture
- Auto-apply prompt fix for NECTOR Demo (first apply-fix implementation)
- Cron: daily (Hobby plan limit)
- Before/after comparison (removed from dashboard, available per-agent)

### Phase 6 — Agent Profile Redesign (`3d5d104`)
- **Main dashboard** → replaced error leaderboard with **agent grid** (cards per agent)
- **`/dashboard/[agentId]`** — per-agent profile page:
  - Agent stat strip (total calls, analyzed, error rate, critical count)
  - Error leaderboard filtered to THAT agent only
  - Patches verified against THAT agent's actual prompt (not hardcoded agent 0)
  - Find text verified badge + exact line number in prompt
  - FixBlock (find/replace UI with copy buttons)
  - ApplyFixButton (NECTOR Demo only, only when find text verified)
  - ApplyAllFixesButton — one click applies all fixable errors
  - Worst calls panel for the agent
  - Prompt version chart (error rate per prompt hash)
  - Collapsible prompt viewer (full system prompt)
  - Loading skeleton
- `verifyPatch()` in fix-specs.ts — checks find text exists, returns line number + context
- `fetchAllAgentPrompts()` in ultravox.ts — fetches ALL agents dynamically
- Apply-fix API pre-flight check — returns 409 if find text not in prompt
- `get_agent_error_summary()` Supabase RPC for agent grid
- All queries parallelized with `Promise.all`
- OKLCH warm palette, Tailwind 4 design tokens

### Phase 7 — Fix-Specs for Non-Sales Agents (`b8f81d3`)
- Fetched and read ALL agent system prompts via Ultravox GET API
- Fixed Sales AI `accepted_garbled_audio`: capitalization mismatch `DO NOT` → `Do NOT`
- Wrote 13 new patches across 5 agents (18 find strings verified against live prompts)
- Multi-agent patch architecture: each error type has N patches, each with different find string targeting different agent prompt text
- `getApplicablePatches()` returns only patches whose find text exists in current agent's prompt
- Verified NECTOR Demo has zero matches (untouched, different domain)

**New patches by agent:**
| Agent | Error types patched |
|-------|-------------------|
| Debt-Collector-Agent-UG | `no_save_debt`, `calculated_balance`, `invented_amount`, `no_product_context`, `no_commitment`, `accepted_vague_date` |
| Cold_Outreach_AI | `accepted_garbled_audio`, `wrong_opening`, `pushed_back`, `no_name_collected`, `restart_loop` |
| Davansh + Edifice | `wrong_info`, `no_save_answers` |

### Phase 9 — Fix-Specs for NECTOR Demo + Real Estate AI (session 2)
- NECTOR Demo: 4 patches written — `wrong_info`, `accepted_garbled_audio`, `no_save_answers`, `stacked_questions`
- Real_Estate_AI: 3 patches written — `broke_promise`, `wrong_info`, `no_save_answers`
- Ramco Gas / Follow-Up Debt / Debt Welcome: verified healthy (no active errors), no patches needed

### Phase 11 — UI/UX Pass: Dark Mode + Polish (session 4)
Key changes: `Nav.tsx`, `PipelineStrip.tsx`, `TrendChart.tsx`, `dashboard/page.tsx`, `globals.css`

**Dark-mode design system (globals.css):**
- Dual-theme OKLCH token set — warm amber accent (hue ~55°), dark canvas (`oklch(14% 0.012 55)`)
- Semantic color layers: `canvas → surface → surface-2 → surface-3`, borders: subtle/default/strong
- Semantic status tokens: `crit`, `warn`, `ok` with matching `-bg` + `-border` variants
- No #000/#fff anywhere — full OKLCH warm palette

**New components:**
- `CountUp.tsx` — animated number counter (Intersection Observer, requestAnimationFrame)
- `Reveal.tsx` — scroll-triggered fade-in (IntersectionObserver)
- `Sparkline.tsx` — inline SVG sparkline for dashboard stat cards
- `ThemeToggle.tsx` — dark/light toggle (persisted to localStorage)

**Dashboard polish:**
- `DISPLAY_NAMES` map — human-readable agent names (no more snake_case raw DB strings)
- `criticalTotal` — critical alert count computed from activeAlerts
- Nav, PipelineStrip, TrendChart restyled for dark theme
- Comment noise removed throughout

### Phase 10 — Repeat Error Tracker + 7 New Features (session 3)
Key commits: `ee62fa1`, `8ce3501`, `66e6527`, `8a75e62`, `8c5b05e`

**Repeat Error Tracker** (`src/lib/repeat-error-tracker.ts`):
- Fires after every call analysis — checks if same error has fired 3+ times in 30 days for this agent
- Three alert tiers: FIX REGRESSION (fix applied but error returned) / apply-now (fix available) / write-patch (no patch yet)
- Auto-applies fix if: allowlisted agent + FP rate < 5% + total_flags ≥ 10 (high-confidence auto-heal)
- Telegram alert includes direct profile page deep-link button

**Telegram inline buttons** (`src/lib/telegram.ts`):
- Shared module with inline keyboard support
- Alert engine sends agent profile URL button per fired alert
- Repeat tracker sends direct `/dashboard/{agentId}` button

**Agent profile page — 4 new sections:**
- ErrorHeatmap: 30-day calendar grid per top-6 error type (server utils in `src/lib/heatmap-utils.ts`)
- OutcomeChart: 12-week stacked bar (success/no_answer/not_interested/incomplete/no_save)
- Before/after comparison: date picker → `?compare=YYYY-MM-DD` → two Supabase queries → per-error counts with % change
- Customer name badge + call date in worst calls panel

**Call detail page:**
- Customer name shown in header (from Llama enrichment)
- Llama `missed_opportunities` rendered as "Coaching Notes · Audio AI" section (separate from Haiku coaching)

**Auto re-analyze after fix:**
- `apply-fix` route now triggers re-analysis of last 15 calls after patching (fire-and-forget)
- Error rates update in ~60s post-fix, no manual reanalyze needed

**Dashboard grid fixes:**
- `get_agent_error_summary` only returned agents with errors — healthy agents were missing
- Fixed: merged with `clientRows` (all clients) to guarantee every agent shows
- Static `KNOWN_AGENT_IDS` map ensures card links work even when DB `agent_id = null`
- "Shell Gas Uganda" mapped to Ramco Gas UUID (actual DB client_name differs from agent name)
- Noise clients (Unknown, Acme Corp, test names) excluded via `EXCLUDED_CLIENTS`
- Result: 7 real agents, all linked ✅

**Structural bugs fixed:**
- `buildHeatmapRows`/`buildOutcomeData` in `'use client'` files → crashed server component → moved to `src/lib/`
- `get_comparison_data` RPC broken → replaced with direct two-query JS computation
- Playwright test artifacts added to `.gitignore`

### Phase 8 — Transcript Examples on Agent Profile (`cc21216`)
- `example_line` (`agent_line` from `call_errors` JSONB) was fetched but never rendered
- Added "Agent said" block inline on each error row

---

## Current State — What Works Right Now

### Data Pipeline
- ✅ 1808+ calls synced, cursor-paginated
- ✅ 639+ analyzed, ~52% error rate
- ✅ Claude Haiku: primary error detection, authoritative
- ✅ Llama 3.2: async audio enrichment (transcript + names, NOT error detection)
- ✅ Webhook: real-time analysis within seconds of call ending
- ✅ Daily cron: 30 unanalyzed calls/run + sync + alert check
- ✅ Race condition safe (batch-claim pattern)
- ✅ jsonrepair for LLM JSON defects
- ✅ 3x retry with exponential backoff

### Error Detection
- ✅ 21 error types across Sales/Debt/Cold Outreach/Inbound
- ✅ Agent-type-aware rules (Haiku prompt varies by agent)
- ✅ `accepted_unknown_location` — detects garbled area names
- ✅ False-positive guard: `no_save_answers`/`no_save_debt` only flags if 4+ agent turns AND no Tool message in final 4 messages
- ✅ Confidence scoring (0.0–1.0 per error)
- ✅ `goal_achieved` field per call

### Dashboard
- ✅ `/dashboard` — agent grid, 7 agents all linked, sorted by call volume
- ✅ `/dashboard/[agentId]` — per-agent profile:
  - Stat strip (total calls, error rate, critical count)
  - Error leaderboard with "Agent said" transcript quote
  - Verified patches with line numbers + find/replace UI
  - Apply Fix (NECTOR Demo + Davansh allowlisted)
  - Apply All Fixes button
  - Worst calls panel (customer name + date shown)
  - **Error Heatmap — 30-day calendar per error type**
  - **Outcome Chart — 12-week stacked success/failure breakdown**
  - **Before/After comparison — date picker, per-error % change**
  - Prompt version chart (error rate by prompt hash)
  - Full prompt viewer (collapsible)
- ✅ Stat strip (7 metrics)
- ✅ AI pipeline strip (p50/p95 latency, cost, success rate)
- ✅ Error rate trend chart (12 weeks, per agent)
- ✅ False positive tracking + precision badges per error type
- ✅ Error velocity sparklines (8-week trend per error type)
- ✅ Eval framework (precision, FP rate, confidence, cost/week)
- ✅ Nav bar: Agents link, monitoring status

### Alerting
- ✅ 6 burst alert rules (Telegram, ack suppression)
- ✅ **Repeat error tracker** — per-call, 30-day window, 3 tiers (regression/apply/write)
- ✅ **Telegram inline buttons** — deep-link to agent profile from every alert
- ✅ Auto-apply for allowlisted agents when FP rate < 5%

### Other
- ✅ REST API v1 (`/stats`, `/errors`, `/calls`, `/calls/:id`, `/export`)
- ✅ MCP server
- ✅ CLI (`npm run voxray stats/errors/monitor`)
- ✅ Fix log (`prompt_fixes` table)
- ✅ Supabase SSR auth (login page)
- ✅ Loading skeletons (instant navigation feedback)
- ✅ LLM observability: every Haiku call traced (latency, tokens, cost) in `llm_traces`
- ✅ Prompt versioning: SHA-256 hash per call → error rate by prompt version

---

## Fix-Specs Coverage

### How it works
Each error type has patches (find→replace strings). On the agent profile page, `verifyPatch()` checks if find text exists in the current agent's actual live prompt. If yes → show patch with line number, enable apply. If no → show "already fixed."

### Coverage status

| Error Type | Sales AI | Debt Collector | Cold Outreach | Davansh | Edifice |
|-----------|----------|---------------|--------------|---------|---------|
| `accepted_unknown_location` | ✅ | — | — | — | — |
| `accepted_garbled_audio` | ✅ | — | ✅ | — | — |
| `no_save_answers` | ✅ | — | ✅ | ✅ | ✅ |
| `no_save_debt` | — | ✅ | — | — | — |
| `no_consultation` | ✅ | — | — | — | — |
| `stacked_questions` | ✅ | — | ✅ | — | — |
| `skipped_repeat_rule` | ✅ | — | ✅ | — | — |
| `accepted_past_date` | ✅ | ✅ | — | — | — |
| `accepted_vague_date` | ✅ | ✅ | — | — | — |
| `broke_promise` | ✅ | — | — | — | — |
| `wrong_opening` | ✅ | — | ✅ | — | — |
| `restart_loop` | ✅ | — | ✅ | — | — |
| `no_name_collected` | ✅ | — | ✅ | — | — |
| `calculated_balance` | ✅ | ✅ | — | — | — |
| `invented_amount` | ✅ | ✅ | — | — | — |
| `no_product_context` | ✅ | ✅ | — | — | — |
| `spoke_luganda` | ✅ | already fixed | — | — | — |
| `wrong_person_handling` | ✅ | — | — | — | — |
| `no_commitment` | ✅ | ✅ | — | — | — |
| `pushed_back` | ✅ | — | ✅ | — | — |
| `wrong_info` | ✅ | — | — | ✅ | ✅ |
| `wrong_call_type` | ✅ | — | — | — | — |

`—` = error type doesn't apply to that agent OR not yet written.

---

## Supabase Schema

### Tables
| Table | Purpose |
|-------|---------|
| `ultravox_calls` | All calls + `call_errors` JSONB + `prompt_hash` + `analysis_status` |
| `ultravox_messages` | Per-message transcripts |
| `llm_traces` | Every Haiku call: `latency_ms`, `input_tokens`, `output_tokens`, `cost_usd`, `model` |
| `prompt_versions` | `prompt_hash → first_seen / last_seen` per agent |
| `false_positives` | Human FP marks: `call_id`, `error_type` |
| `prompt_fixes` | Fix log: `agent`, `error_type`, `description`, `applied_at` |
| `alert_acks` | Suppression records: `rule_id`, `agent`, `ack_until` |

### RPC Functions
| Function | Purpose |
|----------|---------|
| `get_dashboard_aggregates()` | All stat strip counts in one query |
| `get_error_frequency(since, agent)` | Error leaderboard from JSONB — includes `example_line` (agent_line) |
| `get_client_breakdown()` | Agent call counts |
| `get_weekly_trend()` | Weekly error rate per agent (12wk) |
| `get_comparison_data(date)` | Before/after error counts |
| `get_pipeline_stats()` | Haiku p50/p95 latency, cost, success rate |
| `get_eval_stats()` | FP count + total flags per error type |
| `get_prompt_version_trend(agent)` | Error rate per prompt hash |
| `get_error_velocity()` | Weekly count per error type (sparklines) |
| `get_agent_error_summary()` | Per-agent stats for agent grid |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/page.tsx` | Agent grid |
| `src/app/dashboard/[agentId]/page.tsx` | Per-agent profile (errors + patches + transcript examples) |
| `src/app/dashboard/[agentId]/PromptViewer.tsx` | Collapsible prompt viewer |
| `src/app/dashboard/[agentId]/ApplyAllFixesButton.tsx` | Batch apply all fixes |
| `src/lib/fix-specs.ts` | All patch definitions + `verifyPatch()` + `getApplicablePatches()` |
| `src/lib/error-analyzer.ts` | Haiku prompts, 21 error types, confidence scoring |
| `src/lib/call-analyzer.ts` | Unified pipeline: Haiku primary + Llama enrichment + prompt hash |
| `src/lib/ultravox.ts` | Ultravox API client + `fetchAllAgentPrompts()` |
| `src/app/api/webhook/call-ended/route.ts` | Real-time webhook: ACK → background pipeline |
| `src/app/api/agents/[agentId]/apply-fix/route.ts` | Apply fix (NECTOR Demo only, pre-flight verify) |
| `src/app/api/cron/route.ts` | Daily: 30 calls + sync + alerts |
| `src/app/components/FixBlock.tsx` | Find/replace UI with copy buttons |
| `src/app/components/TrendChart.tsx` | 12-week error rate chart |
| `src/app/components/ApplyFixButton.tsx` | One-click apply (NECTOR Demo + Davansh) |
| `src/app/components/ErrorHeatmap.tsx` | 30-day calendar heatmap per error type |
| `src/app/components/OutcomeChart.tsx` | 12-week stacked outcome bar chart |
| `src/app/dashboard/[agentId]/CompareForm.tsx` | Before/after date picker (client component) |
| `src/lib/heatmap-utils.ts` | Server-safe heatmap data builder |
| `src/lib/outcome-utils.ts` | Server-safe outcome data builder |
| `src/lib/repeat-error-tracker.ts` | Recurring error detection + Telegram alert |
| `src/lib/telegram.ts` | Shared Telegram module with inline keyboard |

---

## What's Left — Prioritized

### Next up: UI/UX pass continued (session 5)
Dashboard grid + globals.css done. Remaining:

- [ ] **Agent profile** `/dashboard/[agentId]` — dark theme, section spacing, heatmap readability
- [ ] **Call detail** `/calls/[id]` — transcript readability, inline error highlights in transcript
- [ ] **Loading states** — skeletons dark-themed
- [ ] **Empty states** — no-data views for heatmap/outcome chart
- [ ] **Mobile** — responsive pass on all pages

### Medium priority
- [ ] **Shell Gas Uganda agent profile** — `client_name` is "Shell Gas Uganda" in DB but agent name at Ultravox is "Ramco_Gas_inbound". Heatmap/outcome data works. Fix-specs may not match since patches reference "Ramco Gas" client_name.
- [ ] **Real Estate AI + NECTOR Demo patch verification** — patches written, need live confirmation `verifyPatch()` finds them (run profile pages and check line numbers)
- [ ] **Expand auto-apply allowlist** — currently NECTOR Demo + Davansh. When FP rate < 5% on any production agent error type, consider adding.

### Low priority
- [ ] **Call recordings** — `GET /api/calls/{id}/recording` available, not exposed in UI
- [ ] **README update** — document agent profile flow

---

## Production Safety Rules (Never Change These)

**NEVER POST/PATCH/DELETE to `api.ultravox.ai`.**  
Live Uganda customers. ~100 calls/day. GET only.

Exception: `POST /api/agents/[agentId]/apply-fix` — NECTOR Demo (`428d7591`) only.  
Hard allowlist in route.ts → 403 for any other agent ID.  
Pre-flight `verifyPatch()` runs before any PATCH.

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
VOXRAY_API_KEY=             # optional — API v1 auth
CRON_SECRET=                # optional — cron route auth
```
