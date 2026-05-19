import { z } from 'zod';
import { getSupabase } from '../services/supabase.js';
import { CHARACTER_LIMIT, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants.js';
const ResponseFormat = z.enum(['markdown', 'json']).default('markdown');
export function registerCallTools(server) {
    server.registerTool('voxray_list_calls', {
        title: 'List Calls',
        description: `List Ultravox voice agent calls tracked in Voxray with filtering and pagination.

Supports filtering by agent, error presence, and analysis status. Returns call metadata including duration, cost, error counts, and analysis status. Does NOT return full transcripts — use voxray_get_call for that.

Args:
  - agent (string, optional): Filter by agent name (e.g. "Sales AI", "Debt Collector")
  - has_errors (boolean, optional): If true, only return calls with detected errors
  - analysis_status ('pending' | 'analyzing' | 'complete' | 'error', optional): Filter by analysis state
  - limit (number): Calls per page, 1-100 (default: 20)
  - offset (number): Skip N calls for pagination (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "total": number,
    "count": number,
    "offset": number,
    "has_more": boolean,
    "next_offset": number,
    "calls": [
      {
        "call_id": string,
        "agent": string,
        "status": string,
        "ended_reason": string | null,
        "duration_seconds": number | null,
        "cost_usd": number | null,
        "error_count": number,
        "critical_error_count": number,
        "analysis_status": string | null,
        "created_at": string
      }
    ]
  }

Examples:
  - "Show me all calls with critical errors" → has_errors=true, then filter by critical_error_count
  - "List unanalyzed Sales AI calls" → agent="Sales AI", analysis_status="pending"
  - "What calls happened today?" → use this tool, filter created_at client-side

Error Handling:
  - Returns empty calls array if no calls match filters`,
        inputSchema: z.object({
            agent: z.string().optional().describe('Filter by agent name e.g. "Sales AI", "Debt Collector"'),
            has_errors: z.boolean().optional().describe('If true, only return calls with detected errors'),
            analysis_status: z.enum(['pending', 'analyzing', 'complete', 'error']).optional()
                .describe('Filter by analysis state'),
            limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
                .describe('Calls per page (default: 20)'),
            offset: z.number().int().min(0).default(0).describe('Skip N calls for pagination'),
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ agent, has_errors, analysis_status, limit, offset, response_format }) => {
        try {
            const db = getSupabase();
            let query = db
                .from('ultravox_calls')
                .select('call_id, client_name, status, ended_reason, duration_seconds, cost_usd, error_count, critical_error_count, analysis_status, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (agent)
                query = query.eq('client_name', agent);
            if (has_errors)
                query = query.gt('error_count', 0);
            if (analysis_status)
                query = query.eq('analysis_status', analysis_status);
            const { data: calls, count } = await query;
            const total = count ?? 0;
            const hasMore = offset + limit < total;
            const items = (calls ?? []).map((c) => ({
                call_id: c.call_id,
                agent: c.client_name,
                status: c.status,
                ended_reason: c.ended_reason ?? null,
                duration_seconds: c.duration_seconds ?? null,
                cost_usd: c.cost_usd ?? null,
                error_count: c.error_count ?? 0,
                critical_error_count: c.critical_error_count ?? 0,
                analysis_status: c.analysis_status ?? null,
                created_at: c.created_at,
            }));
            const result = { total, count: items.length, offset, items, has_more: hasMore, ...(hasMore ? { next_offset: offset + limit } : {}) };
            let text;
            if (response_format === 'json') {
                text = JSON.stringify({ ...result, calls: result.items }, null, 2);
            }
            else {
                const lines = [`# Voxray — Calls (${total.toLocaleString()} total)`, ''];
                for (const c of items) {
                    const dur = c.duration_seconds != null
                        ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s`
                        : '—';
                    const errBadge = c.critical_error_count > 0
                        ? ` ⚠ ${c.critical_error_count} critical`
                        : c.error_count > 0 ? ` ! ${c.error_count} errors` : '';
                    const analyzed = c.analysis_status === 'complete' ? '✓' : '·';
                    lines.push(`${analyzed} **${c.agent}** · ${dur} · ${c.ended_reason ?? c.status}${errBadge}`);
                    lines.push(`  \`${c.call_id}\` · ${new Date(c.created_at).toLocaleString()}`);
                    lines.push('');
                }
                if (hasMore)
                    lines.push(`_Showing ${offset + 1}–${offset + items.length} of ${total} — use offset=${offset + limit} for next page_`);
                text = lines.join('\n');
            }
            if (text.length > CHARACTER_LIMIT) {
                text = text.slice(0, CHARACTER_LIMIT) + '\n\n_[Response truncated — reduce limit or add filters]_';
            }
            return {
                content: [{ type: 'text', text }],
                structuredContent: { ...result, calls: result.items },
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            };
        }
    });
    server.registerTool('voxray_get_call', {
        title: 'Get Call Detail',
        description: `Get the full transcript and error analysis for a single Ultravox call.

Returns every message turn (agent, user, tool), the Claude Haiku error analysis including specific errors with what went wrong and what the agent should have said, goal outcome, and missed opportunities.

Use this to deeply understand what happened in a specific call — what mistakes the agent made and exactly where in the transcript they occurred.

Args:
  - call_id (string): The UUID of the call (e.g. "067b2228-7050-45df-b893-8544bc170f65")
  - include_transcript (boolean): Include full conversation transcript (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "call_id": string,
    "agent": string,
    "status": string,
    "ended_reason": string | null,
    "duration_seconds": number | null,
    "cost_usd": number | null,
    "created_at": string,
    "ended_at": string | null,
    "analysis_status": string,
    "error_count": number,
    "critical_error_count": number,
    "analysis": {
      "goal_achieved": boolean,
      "goal_outcome": string,
      "summary": string,
      "missed_opportunities": string[],
      "errors": [
        {
          "type": string,
          "severity": "critical" | "major" | "minor",
          "agent_line": string,       // Exact quote from transcript
          "what_went_wrong": string,
          "should_have_said": string,
          "timestamp_index": number
        }
      ]
    } | null,
    "transcript": [                   // Only if include_transcript=true
      { "role": "agent" | "user" | "tool", "text": string, "ordinal": number }
    ]
  }

Examples:
  - "What went wrong in call abc123?" → use this tool with call_id="abc123"
  - "Show me the transcript of the worst call" → get call_id from voxray_list_errors, then use this tool

Error Handling:
  - Returns "Error: Call not found: <id>" if call_id doesn't exist`,
        inputSchema: z.object({
            call_id: z.string().uuid('Must be a valid UUID').describe('The call UUID'),
            include_transcript: z.boolean().default(true).describe('Include full conversation transcript'),
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ call_id, include_transcript, response_format }) => {
        try {
            const db = getSupabase();
            const [{ data: call }, { data: messages }] = await Promise.all([
                db.from('ultravox_calls').select('*').eq('call_id', call_id).single(),
                include_transcript
                    ? db.from('ultravox_messages').select('role, text, ordinal').eq('call_id', call_id).order('ordinal')
                    : Promise.resolve({ data: null }),
            ]);
            if (!call) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error: Call not found: ${call_id}` }],
                };
            }
            const analysis = call.call_errors;
            const transcript = include_transcript
                ? (messages ?? []).map((m) => ({
                    role: m.role.includes('AGENT') || m.role === 'agent' ? 'agent'
                        : m.role.includes('TOOL') ? 'tool' : 'user',
                    text: m.text,
                    ordinal: m.ordinal,
                }))
                : [];
            const result = {
                call_id: call.call_id,
                agent: call.client_name,
                status: call.status,
                ended_reason: call.ended_reason ?? null,
                duration_seconds: call.duration_seconds ?? null,
                cost_usd: call.cost_usd ?? null,
                created_at: call.created_at,
                ended_at: call.ended_at ?? null,
                analysis_status: call.analysis_status ?? 'pending',
                error_count: call.error_count ?? 0,
                critical_error_count: call.critical_error_count ?? 0,
                analysis: analysis ? {
                    goal_achieved: analysis.goal_achieved,
                    goal_outcome: analysis.goal_outcome,
                    summary: analysis.summary,
                    missed_opportunities: analysis.missed_opportunities,
                    errors: analysis.errors,
                } : null,
                ...(include_transcript ? { transcript } : {}),
            };
            let text;
            if (response_format === 'json') {
                text = JSON.stringify(result, null, 2);
            }
            else {
                const dur = result.duration_seconds != null
                    ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s` : '—';
                const lines = [
                    `# ${result.agent} — ${result.call_id.substring(0, 16)}…`,
                    `${dur} · ${result.ended_reason ?? result.status} · ${new Date(result.created_at).toLocaleString()}`,
                    '',
                ];
                if (result.analysis) {
                    const a = result.analysis;
                    lines.push(a.goal_achieved ? '✓ **Goal achieved**' : '✗ **Goal NOT achieved**');
                    lines.push(`_${a.summary}_`);
                    lines.push('');
                    if (a.errors.length > 0) {
                        lines.push(`## Errors (${a.errors.length})`);
                        for (const e of a.errors) {
                            lines.push(`### ${e.severity.toUpperCase()} — \`${e.type}\``);
                            lines.push(`**Agent said:** "${e.agent_line}"`);
                            lines.push(`**Problem:** ${e.what_went_wrong}`);
                            lines.push(`**Should have said:** ${e.should_have_said}`);
                            lines.push('');
                        }
                    }
                    if (a.missed_opportunities.length > 0) {
                        lines.push('## Missed Opportunities');
                        a.missed_opportunities.forEach((o) => lines.push(`- ${o}`));
                        lines.push('');
                    }
                }
                else {
                    lines.push('_Not yet analyzed. Use voxray_analyze_call to trigger analysis._');
                    lines.push('');
                }
                if (include_transcript && transcript.length > 0) {
                    lines.push('## Transcript');
                    for (const m of transcript) {
                        const roleLabel = m.role === 'agent' ? '🤖 Agent' : m.role === 'tool' ? '🔧 Tool' : '👤 User';
                        lines.push(`**[${m.ordinal}] ${roleLabel}:** ${m.text}`);
                    }
                }
                text = lines.join('\n');
            }
            if (text.length > CHARACTER_LIMIT) {
                text = text.slice(0, CHARACTER_LIMIT) + '\n\n_[Response truncated — use include_transcript=false to see analysis without full transcript]_';
            }
            return {
                content: [{ type: 'text', text }],
                structuredContent: result,
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            };
        }
    });
    server.registerTool('voxray_analyze_call', {
        title: 'Analyze Call',
        description: `Trigger Claude Haiku error analysis on a specific Ultravox call. Stores results in Voxray.

This runs the call transcript through Claude Haiku with agent-type-aware prompts (Sales, Debt Collector, Cold Outreach) to detect specific mistakes against known error types. Results are persisted and visible in the Voxray dashboard.

Only use this for calls that haven't been analyzed yet (analysis_status = "pending" or "error"). It costs Anthropic API tokens.

Args:
  - call_id (string): UUID of the call to analyze
  - force (boolean): Re-analyze even if already complete (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "call_id": string,
    "agent": string,
    "error_count": number,
    "critical_error_count": number,
    "goal_achieved": boolean,
    "goal_outcome": string,
    "summary": string,
    "errors": [ { "type": string, "severity": string, "what_went_wrong": string } ]
  }

Examples:
  - "Analyze call abc123" → use this tool with call_id="abc123"
  - "Re-run analysis on this call" → use this tool with force=true

Error Handling:
  - Returns "Error: Call not found" if call_id doesn't exist
  - Returns "Already analyzed. Pass force=true to re-analyze." if status is complete and force=false
  - Returns "Error: No messages found" if call has no transcript`,
        inputSchema: z.object({
            call_id: z.string().uuid('Must be a valid UUID').describe('UUID of the call to analyze'),
            force: z.boolean().default(false).describe('Re-analyze even if already complete (costs tokens)'),
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ call_id, force, response_format }) => {
        try {
            const db = getSupabase();
            const { data: call } = await db
                .from('ultravox_calls')
                .select('call_id, client_name, analysis_status')
                .eq('call_id', call_id)
                .single();
            if (!call) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error: Call not found: ${call_id}` }],
                };
            }
            if (call.analysis_status === 'complete' && !force) {
                return {
                    content: [{ type: 'text', text: 'Already analyzed. Pass force=true to re-analyze.' }],
                };
            }
            const { data: messages } = await db
                .from('ultravox_messages')
                .select('role, text, ordinal')
                .eq('call_id', call_id)
                .order('ordinal');
            if (!messages || messages.length === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Error: No messages found for this call. Cannot analyze.' }],
                };
            }
            // Dynamic import to keep the MCP server decoupled from Next.js
            const { detectAgentType, analyzeCallErrors } = await import('../../src/lib/error-analyzer.js');
            await db.from('ultravox_calls').update({ analysis_status: 'analyzing' }).eq('call_id', call_id);
            const agentType = detectAgentType(call.client_name);
            const analysis = await analyzeCallErrors(messages.map((m) => ({ role: m.role, text: m.text, ordinal: m.ordinal })), 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            agentType);
            await db.from('ultravox_calls').update({
                call_errors: analysis,
                analysis_status: 'complete',
                error_count: analysis.error_count,
                critical_error_count: analysis.critical_error_count,
            }).eq('call_id', call_id);
            const result = {
                call_id,
                agent: call.client_name,
                error_count: analysis.error_count,
                critical_error_count: analysis.critical_error_count,
                goal_achieved: analysis.goal_achieved,
                goal_outcome: analysis.goal_outcome,
                summary: analysis.summary,
                errors: analysis.errors.map((e) => ({
                    type: e.type,
                    severity: e.severity,
                    what_went_wrong: e.what_went_wrong,
                })),
            };
            let text;
            if (response_format === 'json') {
                text = JSON.stringify(result, null, 2);
            }
            else {
                const icon = analysis.goal_achieved ? '✓' : '✗';
                const lines = [
                    `${icon} **${result.agent}** — Analysis complete`,
                    `${analysis.error_count} errors (${analysis.critical_error_count} critical)`,
                    `_${analysis.summary}_`,
                    '',
                ];
                if (analysis.errors.length > 0) {
                    for (const e of analysis.errors) {
                        lines.push(`- **${e.severity.toUpperCase()}** \`${e.type}\`: ${e.what_went_wrong}`);
                    }
                }
                text = lines.join('\n');
            }
            return {
                content: [{ type: 'text', text }],
                structuredContent: result,
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            };
        }
    });
    server.registerTool('voxray_sync_calls', {
        title: 'Sync Calls from Ultravox',
        description: `Pull the latest 100 calls from Ultravox into Voxray and auto-analyze any new calls that have enough messages.

Hits the Voxray sync API which: fetches calls from Ultravox (GET only — no mutations), upserts into Supabase, fetches messages and tools for ended calls, and auto-analyzes new ended calls with 3+ messages.

Use this when you need fresh data before querying errors or calls.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "synced": number,    // Calls upserted
    "messages": number,  // Messages fetched
    "analyzed": number,  // New calls auto-analyzed
    "total": number      // Total calls returned by Ultravox API
  }

Examples:
  - "Get the latest calls" → use this tool first, then voxray_list_calls
  - "Are there any new errors today?" → use this tool, then voxray_list_errors

Error Handling:
  - Returns "Error: VOXRAY_URL not configured" if env var missing
  - Returns Ultravox API errors if sync fails`,
        inputSchema: z.object({
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ response_format }) => {
        try {
            const baseUrl = process.env.VOXRAY_URL;
            if (!baseUrl) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: 'Error: VOXRAY_URL env var not set. Set it to https://voxray.vercel.app or http://localhost:3000' }],
                };
            }
            const res = await fetch(`${baseUrl}/api/sync`, { method: 'POST' });
            if (!res.ok) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error: Sync failed with status ${res.status}` }],
                };
            }
            const data = await res.json();
            const text = response_format === 'json'
                ? JSON.stringify(data, null, 2)
                : `✓ Sync complete: **${data.synced}** calls synced, **${data.messages}** messages, **${data.analyzed}** auto-analyzed (${data.total} total from Ultravox)`;
            return {
                content: [{ type: 'text', text }],
                structuredContent: data,
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            };
        }
    });
}
//# sourceMappingURL=calls.js.map