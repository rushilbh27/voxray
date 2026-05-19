# Voxray

X-ray vision for Ultravox voice agents. Detects exact agent mistakes per call, surfaces error patterns, and generates precise Find→Replace prompt fixes.

**Live:** https://voxray.vercel.app

---

## What it does

- Syncs all calls from Ultravox into Supabase
- Runs Claude Haiku analysis on each call transcript — detects agent-specific rule violations
- Error leaderboard with human-readable labels + structured prompt fixes (Find → Replace with copy buttons)
- Fetches current agent system prompts from Ultravox to check if each fix was already applied
- MCP server for AI agent access, REST API v1, CLI

## Stack

Next.js 16 · TypeScript · Tailwind · Supabase · Ultravox REST API · Claude Haiku

---

## Setup

```bash
npm install

# .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ULTRAVOX_API_KEY=...
ANTHROPIC_API_KEY=...
DEMO_USER_EMAIL=...
DEMO_USER_PASSWORD=...
VOXRAY_URL=https://voxray.vercel.app
```

```bash
npm run dev          # localhost:3000
npm run sync         # pull latest calls from Ultravox
npm run analyze      # batch analyze unanalyzed calls
```

---

## Commands

```bash
npm run sync                    # sync latest 100 calls + auto-analyze new
npm run sync:full               # sync ALL calls
npm run analyze                 # batch analyze unanalyzed calls with messages
npm run voxray stats            # CLI: dashboard metrics
npm run voxray errors           # CLI: error leaderboard with fixes
npm run voxray calls            # CLI: call list
npm run voxray call <id>        # CLI: full call + transcript
npm run voxray analyze <id>     # CLI: analyze one call
npm run voxray sync             # CLI: trigger sync
npm run voxray monitor          # CLI: watch for new critical errors
npm run mcp                     # MCP server (stdio)
TRANSPORT=http npm run mcp      # MCP server (HTTP :3001)
```

---

## API v1

```
GET  /api/v1/stats
GET  /api/v1/errors?agent=X&limit=N
GET  /api/v1/calls?agent=X&has_errors=true&page=N
GET  /api/v1/calls/:id
POST /api/sync
POST /api/calls/:id/analyze
```

---

## MCP Server

7 tools: `voxray_get_stats` · `voxray_get_agent_summary` · `voxray_list_errors` · `voxray_list_calls` · `voxray_get_call` · `voxray_analyze_call` · `voxray_sync_calls`

Add to Claude Code:
```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "voxray": {
      "command": "node",
      "args": ["/path/to/voxray/voxray-mcp-server/dist/index.js"],
      "env": { "VOXRAY_URL": "https://voxray.vercel.app" }
    }
  }
}
```

---

## Production Safety

**NEVER POST/PATCH/DELETE to `api.ultravox.ai`** — live Uganda customers, ~100 calls/day. See `AGENTS.md`.

Prompt fixes are **safe mode only** — Voxray suggests, human applies manually in Ultravox.
