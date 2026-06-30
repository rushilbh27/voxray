# Voxray — Project Status Report

> Last updated: 2026-06-30 (session 14 — uncrypt agent info API + SchoolPay qual fix + late call ending diagnosis)  
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

### Phase 12 — Dark Theme Completion + Mobile + Empty States (session 5)
Key commit: `e0ccdc6`

**FixBlock.tsx:** Complete rewrite. Was entirely hardcoded light-mode Tailwind (`gray-*`, `red-*`, `green-*`). Now uses `crit-bg`/`ok-bg`/`border-border` OKLCH tokens. Find section uses `crit-bg` tones, Replace section uses `ok-bg` tones. Copy buttons use `border-border`/`text-ink-3`.

**AnalyzeButton.tsx:** Replaced `blue-500`/`gray-900` hardcodes with `text-accent`/`bg-accent`/`text-ink-3` tokens.

**OutcomeChart.tsx:** Fixed Recharts CSS variable refs — `var(--ink-3)` → `var(--color-ink-3)`, same for `surface`/`border`/`ink`. Converted OUTCOME_COLORS hex to OKLCH literals matching design palette (ok/warn/crit tokens).

**ErrorHeatmap.tsx:** Label column now sticky (`sticky left-0 z-10 bg-surface`) — survives horizontal scroll on narrow screens. Added `minWidth: 480` to prevent table collapse.

**`/calls/[id]/loading.tsx`:** Created. Chat-bubble transcript skeleton with alternating agent/user bubbles, call header card skeleton, right column skeleton — mirrors actual page layout.

**Agent profile page:** Heatmap and outcome chart sections always render (not gated behind `length > 0`). Both have real empty states ("✓ No errors in last 30 days" / OutcomeChart handles its own empty). Compare grid changed `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`.

**Call detail page:** Breadcrumb fixed — was `href="/"` (broken), now `href="/dashboard"`.

### Phase 13 — Homepage Redesign + Dashboard Bug Fix (session 6)
Key commit: `c363082`

**Homepage (`page.tsx` + `HomeSections.tsx` + `HeroScroll.tsx`):**
- Navbar: sharp industrial style — no rounded corners, tight tracking, monospace accents, `border-b border-border` edge
- `HomeSections.tsx` (434 lines, new file) — full below-fold:
  - Stats bar: 1808+ calls · 52% error rate · <3s latency · 21 error types (GSAP scroll batch reveal)
  - Benefits grid: Catch / Fix / Prove — 3-column with icon, proof line, GSAP entrance
  - How It Works: 3 numbered panels (01/02/03)
  - Footer CTA strip
- `page.tsx` simplified: logic extracted into HomeSections, hero phases unchanged
- `tsconfig.json`: `skills/` and `dom.html` excluded (were being scanned by TS, causing noise)

**Dashboard fix (`dashboard/page.tsx`):**
- Sparkline SVG was overlapping critical badge on agent cards — z-index + layout fix
- `Pill` component placement adjusted so badge renders above sparkline layer

### Phase 14 — Final Polish + Allowlist Expansion (session 7)
Key commits: `4086557`, `c48e7c0`, `d79126f`

**Transcript readability** (`TranscriptMessage.tsx`, new client component):
- Messages > 300 chars: collapsible with `↓ show more` / `↑ show less` toggle
- `whitespace-pre-wrap break-words` — long agent scripts don't overflow mobile
- `max-w-[78%] sm:max-w-[82%]`

**Agent profile loading skeleton** (full rebuild `[agentId]/loading.tsx`):
- Covers all sections: header, stat strip, error leaderboard + worst calls side-by-side, heatmap (30 squares × 5 rows), outcome chart (12 stacked bars), before/after section
- Matches actual page layout — no jump on content load

**Mobile pass:**
- `px-6` → `px-4 sm:px-6` on agent profile + call detail pages
- Agent name + buttons: `flex-col sm:flex-row` — stacks on phone
- Agent UUID: `break-all sm:break-normal`
- Error Intelligence header, Before/After, Outcome chart headers: all `flex-col sm:flex-row`

**Display names** (`DISPLAY_NAMES` map on agent profile):
- All 12 agents have clean display names. "Shell Gas Uganda" / "Ramco_Gas_inbound" → "Ramco Gas"
- `clientName` (raw DB) still used for RPC queries; `displayName` only for UI

**Call recordings UI** (call detail page):
- `fetchCallRecordingUrl` already existed in `ultravox.ts`
- Added to parallel fetch. Native `<audio controls>` player renders above Error Analysis when URL available

**README rewrite:**
- Full rewrite: agent profile flow table, fix lifecycle, architecture, production safety, agents + patch status table

**Apply-fix all agents + manual-only:**
- `apply-fix/route.ts`: all 11 agent UUIDs in `ALLOWED_AGENTS`. Unknown UUIDs still 403.
- `ApplyFixButton.tsx`: NECTOR-only gate removed. Confirmation shows exact error type + agent name.
- `ApplyAllFixesButton.tsx`: allowlist check removed.
- Agent profile: `isAllowlisted = true` for all agents.
- `repeat-error-tracker.ts`: `AUTO_APPLY_ALLOWLIST` deleted. `auto_applied` hardcoded `false`. Tracker fires Telegram alerts only — never patches automatically.

### Phase 8 — Transcript Examples on Agent Profile (`cc21216`)
- `example_line` (`agent_line` from `call_errors` JSONB) was fetched but never rendered
- Added "Agent said" block inline on each error row

### Phase 15 — Cost Dashboard + Inbound AgentType + New Error Detection (session 8)
Key commit: `8e99f2d`

**Patch verification:**
- Real Estate AI (`efecb97c`): all 3 patches verified against live prompt ✅
- NECTOR Demo (`428d7591`): `stacked_questions` find text gone → patch was already applied ✅. Other 3 verified ✅.

**Cost & Usage dashboard (`CostBreakdown.tsx`):**
- New server component — no `use client`, no Recharts. Pure CSS horizontal bars.
- Summary tiles: Today / This week / All time cost
- Per-agent-type bars: Sales AI / Debt Collector / Cold Outreach with $X.XX labels + call count
- Avg cost per analysis + total analyses header stat
- Added `llm_traces` cost query to dashboard `Promise.all` — 30-day window
- Renders below PipelineStrip on `/dashboard`
- Live data: ~$0.29–$0.48/day, $1.03 all-time across 137 costed traces

**New error types + inbound AgentType:**
- Analyzed 400 recent calls — found 50 `wrong_call_type` flags, all Shell Gas Uganda FPs
- Root cause: Shell Gas Uganda has 0 agent_ids in DB → always used static Sales AI rules → sales rules flag inbound behavior as `wrong_call_type`
- Fix: added `'inbound'` to `AgentType` union. `detectAgentType()` now maps Shell Gas/Ramco/Edifice/Davansh/NECTOR/UCC → `'inbound'`
- New inbound rules section: `wrong_company_name` (CRITICAL), `wrong_agent_name` (CRITICAL), `stacked_questions`, `no_save_answers`, `broke_promise`, `wrong_info`, `accepted_garbled_audio`. Does NOT flag `wrong_call_type` for inbound behavior.
- Real finding: NECTOR Demo was saying "Shell Gas Uganda" + "Susan" instead of configured company/agent name — now tracked as `wrong_company_name` / `wrong_agent_name`
- Same `inbound` rules added to `audio-analyzer.ts` (Llama path)

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
| `src/app/page.tsx` | Public homepage (hero phases, floating nav) |
| `src/app/components/HeroScroll.tsx` | Scroll-scrubbed video hero (GSAP ScrollTrigger) |
| `src/app/components/HomeSections.tsx` | Below-fold: stats bar, benefits, how-it-works, CTA |
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

### ✅ Done: Homepage redesign (session 6)
- GSAP scroll-scrubbed video hero + below-fold SaaS sections + dashboard bug fix

### ✅ Done: Final polish + all-agent patching (session 7)
- Transcript collapse (>300 chars collapsible)
- Agent profile skeleton full rebuild (heatmap, outcome, before/after covered)
- Mobile pass (padding, stacking headers, UUID break-all)
- Shell Gas / Ramco Gas display name fixed (DISPLAY_NAMES map)
- Call recordings audio player on call detail page
- README full rewrite
- apply-fix expanded to all 11 agents, manual-only, auto-apply killed

### ✅ Done: Cost dashboard + inbound agent type + error detection (session 8)
- CostBreakdown.tsx on main dashboard
- inbound AgentType fixes 50+ wrong_call_type FPs for Shell Gas Uganda
- wrong_company_name / wrong_agent_name detection added

### ✅ Done: Patch verification (session 8)
- Real Estate AI: all 3 patches verified ✅
- NECTOR Demo: stacked_questions already applied, other 3 verified ✅

### Phase 16 — /docs Page + Nav Polish + Login + Launch Hardening (session 9)

**Navigation:**
- Homepage navbar: removed redundant Dashboard/Errors text links; Docs = outlined box button, Dashboard = filled accent button
- Hero CTA button: removed `rounded-lg`, matched nav style (sharp, mono, uppercase)
- CTA section: removed glow-bg, `bg-canvas` — no longer visually "weird and standing out"

**`/docs` page (`src/app/docs/page.tsx`):**
- Full Next.js server component at `/docs` — public, no auth redirect
- Sticky sidebar with anchor nav (Overview, Dashboard, REST API v1, MCP Server, CLI, Alerting, Error Types)
- Sharp corners throughout (no `rounded-*`) — matches app design system
- 23-row Error Types reference table, curl examples + JSON responses, MCP stdio + HTTP setup, CLI 7 commands
- `← Home` + `Dashboard →` links in header

**Login page redesign (`src/app/login/page.tsx`):**
- Full rewrite: sharp corners, ambient radial glow (amber), design token labels, mono uppercase tracking
- Removed all `rounded-*`, matched nav button style

**New agent detection (`src/lib/ultravox.ts`, `src/app/dashboard/page.tsx`):**
- Added `fetchAgents()` — paginates `GET /api/agents`
- Dashboard fetches live agents in parallel; zero-call new agents now appear in agent grid immediately

**Launch hardening:**
- `robots.ts` — bots allowed `/` and `/docs`, blocked `/dashboard /errors /calls /api`
- `sitemap.ts` — `/` and `/docs` indexed
- `layout.tsx` — OG + Twitter card metadata, `metadataBase`
- `.env.example` — documented all env vars with security warnings
- `vercel.json` — cron reverted to daily (Hobby plan limit; hourly = Pro only)
- Env vars set in Vercel: `VOXRAY_API_KEY`, `CRON_SECRET`, `ULTRAVOX_WEBHOOK_SECRET`
- **Site is live and launched: https://voxray.vercel.app** 🚀

### ✅ Done: Session 13 — Inbound Agent Overhaul + SchoolPay Creation (2026-06-30)

**Ultravox agent work (outside Voxray dashboard — prompt/tool changes on uncrypt/Ultravox directly):**
- All 7 inbound agents patched with `Inbound_Template_v1.txt` — standardized system prompt, unified call flow, saveAnswers schema
- `getDateTime` tool v3 (`1aa4feb7`): `precomputable: false` + `AGENT_REACTION_SPEAKS` — fires only when caller mentions relative date, agent keeps speaking during run. All 10 inbound agents use this tool.
- `/get-datetime` deployed on uncrypt — EAT (UTC+3) time/date/day
- `firstSpeakerSettings` fixed for all inbound agents → agent speaks first, generates greeting from systemPrompt
- Ramco Gas tool nameOverrides fixed (`hangUp_1`/`saveAnswers_1` → `hangUp`/`saveAnswers`)
- SchoolPay agent created (`5f13f8df-e778-44be-abb4-49be1d1c862c`) — replaces deleted glotrans. 102 KB questions, 4 qualification Qs, full inbound template, webhook + SIP via `/setup-inbound`

**Interrupted (session 14 must finish first):**
- Dead tool IDs `f54c0efb` (v1) and `f2c78bb2` (v2) NOT yet deleted
- `getDateTime_v3` NOT yet renamed to `getDateTime`
- Agent prompts NOT yet updated to reference `getDateTime` (currently say `getDateTime_v3`)

### ✅ Done: Session 14 — Uncrypt Agent Info API + SchoolPay Qual Fix + Diagnosis (2026-06-30)

**Uncrypt API (in uncrypt repo, not voxray):**
- `GET /agents/inbound` — lists all 8 active inbound agents with name + UUID
- `GET /agents/{id}/info` — parses DATA ENTRY block from agent's system prompt, returns structured JSON (company_name, agent_name, company_info, knowledge_base, qualification_questions, closing_qualification_question, customer_intent_values)
- `PATCH /agents/{id}/info` — merges partial update, rebuilds DATA ENTRY block, PATCHes Ultravox with full callTemplate spread. Returns updated_fields list.
- All 3 endpoints require `X-Agent-Key: 712c73bd...` header → 401 if missing/wrong
- Parser handles both bracket format (`KEY = [\n...\n]`) and bare format (no brackets) — needed for nectortechnology_inbound
- `INBOUND_AGENTS` allowlist: 8 correct new-format agents (`companyname_inbound` naming)
- Part 3 HTML API doc created (same style as Part 1/2), saved to `~/Downloads/inbound_agent_api_doc_part3.html`

**SchoolPay agent `5f13f8df` patched on Ultravox:**
- STEP 4 changed from soft ask to MANDATORY — "Before I let you go... may I ask you a few quick questions?" — agent proceeds without waiting for agreement
- Qualification questions updated (3 new): school name + location, ongoing issue type, immediate assistance needed
- Closing: "I have created your support ticket. What is the best date and time our team can reach you for a physical visit if needed?"

**Late call ending — diagnosed (no fix applied yet):**
- Root cause: saveAnswers is a BLOCKING HTTP tool. Prompt says "WAIT for saveAnswers to return" — double block (tool reaction + prompt instruction). Then agent speaks closing. Then hangUp = second blocking HTTP round-trip. Two sequential webhook RTTs = 8–12s dead air.
- Fix options: (1) `staticResponse` on saveAnswers — returns immediately, fires webhook in background. No wait. (2) `AGENT_REACTION_SPEAKS` — agent speaks closing WHILE saveAnswers runs in parallel. (3) Restructure: say closing FIRST, then save, then hangUp. Option 1 or 3 cleanest.

### Remaining (not blockers)
- [ ] **Fix late call ending** — add `staticResponse` to saveAnswers tool OR restructure prompt to say closing first then save
- [ ] **Finish session 13 cleanup** — delete v1/v2 tools (`f54c0efb`, `f2c78bb2`), rename v3 (`1aa4feb7`) → `getDateTime`, update agent prompts
- [ ] **Add SchoolPay to Voxray grid** — agent `5f13f8df`, needs AgentType + fix-specs
- [ ] **Shell Gas agent_id** — `UPDATE ultravox_calls SET agent_id = '428d7591-...' WHERE client_name = 'Shell Gas Uganda' AND agent_id IS NULL`
- [ ] **Multi-agent diff view** — compare two agents side-by-side
- [ ] **Email digest** — weekly error summary, Supabase edge function
- [ ] **Cost trend chart** — daily cost over time (currently only summary tiles)

---

## Production Safety Rules (Never Change These)

**NEVER POST/PATCH/DELETE to `api.ultravox.ai`.**  
Live Uganda customers. ~100 calls/day. GET only.

Exception: `POST /api/agents/[agentId]/apply-fix` — all 11 known agents in hard allowlist.  
Unknown UUIDs → 403. Auth-gated. Manual only — no auto-apply.  
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

---

## ✅ COMPLETED: Build Fix + Logout Fix (session 12, commits `fedcc2d` `1a37596`)

**What was fixed:**
- `tsconfig.json` — added `scripts/` to exclude. `scripts/queue-llama-all.ts` WebSocket type error killed ALL Vercel builds since session 10. Every deploy after `91fff4b` was `ERROR` state. This unblocked 4 pending commits (null prompt_hash fix, badge rename, curl preview, logout fix) all at once.
- `api/logout/route.ts` — `NextResponse.redirect` 307 → 303. Browser was re-POSTing to `/login` after sign-out, giving "Cannot POST /login". 303 forces GET.

**Researched for next session:**
- Shell Gas Uganda: 92 calls with `agent_id = null`. Fix is one SQL UPDATE: `SET agent_id = '428d7591-...' WHERE client_name = 'Shell Gas Uganda' AND agent_id IS NULL`.
- Cost trend chart: `llm_traces` has 9 days of data (2026-05-22 → 2026-05-31), 25,819 traces. Ready to build daily cost bar chart.

---

## ✅ COMPLETED: Bug Fixes + Apply-Fix Curl Preview (session 11, commit `b76cd9b`)

**What was built:**
- `PromptVersionChart.tsx` — null-guard on `prompt_hash` (`?? '??????'` before `.slice`). Fixes `TypeError: Cannot read properties of null (reading 'slice')` crash on Cold Outreach agent page.
- `[agentId]/page.tsx` — filter null `prompt_hash`/`first_used` rows before passing to `PromptVersionChart`. Double guard.
- `[agentId]/page.tsx` — "Auto-fix enabled" badge (showed on every agent always, misleading) → `"{N} fixes ready"` badge, only rendered when fixable errors actually exist.
- `apply-fix/route.ts` — returns `patches[]` (label/find/replace per applied patch) + `curl_preview` (full `curl -X PATCH` command with redacted API key) in success response.
- `ApplyFixButton.tsx` — success state now shows `view curl` toggle. Expands to show full PATCH curl in scrollable pre block with copy button.

**Verified:** All agents' `callTemplate` fields confirmed via live GET — `recordingEnabled`, `selectedTools`, `voice`, `model`, `temperature`, `vadSettings`, `inactivityMessages` all preserved by `...agent.callTemplate` spread. Only `systemPrompt` changes.

---

## ✅ COMPLETED: Llama Full Fallback When Haiku Down (session 10, commits `6394341`→`91fff4b`)

**What was built:**
- `call-analyzer.ts` — Haiku wrapped in try/catch; on failure returns `haiku_failed=true` + empty analysis placeholder
- `audio-analyzer.ts` — timeouts bumped to 6min (recording fetch + Llama queue)
- `webhook/call-ended/route.ts` — sets `analysis_status: 'llama_pending'` when `haiku_failed`
- `webhook/transcript/route.ts` — full rework: checks `analysis_status` before saving; if `llama_pending`/`error`/`pending`, parses Llama errors via `parseExtractedToAnalysis()` and saves as `call_errors` + marks `complete`
- `cron/route.ts` — detects Haiku down on first failure (`haikuDown` flag), routes remaining directly to Llama; `llama_pending` retry limit 20 → 100
- `scripts/queue-llama-all.ts` (NEW) — one-time backfill script: 2 concurrent, 5s batches, 3 retries, keeps `llama_pending` on failure

**Status:** Fully automatic. New calls auto-route to Llama when Haiku down. Cron clears ~130 backlogged calls/hour.
