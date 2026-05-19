import { z } from 'zod';
import { getSupabase } from '../services/supabase.js';
const ResponseFormat = z.enum(['markdown', 'json']).default('markdown');
export function registerStatsTools(server) {
    server.registerTool('voxray_get_stats', {
        title: 'Get Voxray Dashboard Stats',
        description: `Get aggregate performance metrics for all Ultravox voice agent calls tracked in Voxray.

Returns live counts and rates across all 1800+ calls: total volume, success rate, cost, average duration, how many calls have been analyzed by Claude, and the current error rate.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "total_calls": number,          // Total calls synced from Ultravox
    "active_calls": number,         // Calls currently in progress
    "ended_calls": number,          // Calls that have completed
    "success_rate_pct": number,     // % of ended calls that didn't error/unjoined
    "total_cost_usd": number,       // Total Ultravox billed cost
    "avg_duration_seconds": number, // Average call duration (calls with > 0s)
    "total_analyzed": number,       // Calls analyzed by Claude Haiku
    "calls_with_errors": number,    // Analyzed calls that had ≥1 error detected
    "error_rate_pct": number        // calls_with_errors / total_analyzed * 100
  }

Examples:
  - "What is the current error rate?" → use this tool, read error_rate_pct
  - "How much have we spent on Ultravox?" → use this tool, read total_cost_usd
  - "How many calls have been analyzed?" → use this tool, read total_analyzed

Error Handling:
  - Returns "Error: Missing Supabase configuration" if env vars not set`,
        inputSchema: z.object({
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ response_format }) => {
        try {
            const db = getSupabase();
            const [{ count: totalCalls }, { count: endedCount }, { count: successfulCount }, { count: activeCalls }, { count: totalAnalyzed }, { count: callsWithErrors }, { data: aggregateRows },] = await Promise.all([
                db.from('ultravox_calls').select('*', { count: 'exact', head: true }),
                db.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
                db.from('ultravox_calls').select('*', { count: 'exact', head: true })
                    .eq('status', 'ended').not('ended_reason', 'in', '(error,unjoined)'),
                db.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                db.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
                db.from('ultravox_calls').select('*', { count: 'exact', head: true })
                    .gt('error_count', 0).eq('analysis_status', 'complete'),
                db.from('ultravox_calls').select('cost_usd, duration_seconds').range(0, 9999),
            ]);
            const totalCost = (aggregateRows ?? []).reduce((s, c) => s + (c.cost_usd || 0), 0);
            const withDuration = (aggregateRows ?? []).filter((c) => (c.duration_seconds || 0) > 0);
            const avgDuration = withDuration.length > 0
                ? Math.round(withDuration.reduce((s, c) => s + (c.duration_seconds || 0), 0) / withDuration.length)
                : 0;
            const stats = {
                total_calls: totalCalls ?? 0,
                active_calls: activeCalls ?? 0,
                ended_calls: endedCount ?? 0,
                success_rate_pct: (endedCount ?? 0) > 0
                    ? Math.round(((successfulCount ?? 0) / (endedCount ?? 1)) * 100) : 0,
                total_cost_usd: Math.round(totalCost * 100) / 100,
                avg_duration_seconds: avgDuration,
                total_analyzed: totalAnalyzed ?? 0,
                calls_with_errors: callsWithErrors ?? 0,
                error_rate_pct: (totalAnalyzed ?? 0) > 0
                    ? Math.round(((callsWithErrors ?? 0) / (totalAnalyzed ?? 1)) * 100) : 0,
            };
            let text;
            if (response_format === 'json') {
                text = JSON.stringify(stats, null, 2);
            }
            else {
                const dur = `${Math.floor(stats.avg_duration_seconds / 60)}m ${stats.avg_duration_seconds % 60}s`;
                text = [
                    '# Voxray — Dashboard Stats',
                    '',
                    `| Metric | Value |`,
                    `|--------|-------|`,
                    `| Total Calls | **${stats.total_calls.toLocaleString()}** |`,
                    `| Active Now | ${stats.active_calls} |`,
                    `| Success Rate | **${stats.success_rate_pct}%** |`,
                    `| Total Cost | **$${stats.total_cost_usd.toFixed(2)}** |`,
                    `| Avg Duration | ${dur} |`,
                    `| Analyzed | **${stats.total_analyzed}** / ${stats.total_calls} |`,
                    `| Calls w/ Errors | **${stats.calls_with_errors}** |`,
                    `| Error Rate | **${stats.error_rate_pct}%** |`,
                ].join('\n');
            }
            return {
                content: [{ type: 'text', text }],
                structuredContent: stats,
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            };
        }
    });
    server.registerTool('voxray_get_agent_summary', {
        title: 'Get Per-Agent Error Summary',
        description: `Get a breakdown of error rates, call counts, and top error types grouped by each Ultravox agent (Sales AI, Debt Collector, Cold Outreach, etc.).

Use this to compare which agent is performing worst, which error types are unique to each agent, and where to focus prompt improvement effort.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  Array of agent summaries:
  [
    {
      "agent": string,             // Agent name (e.g. "Sales AI")
      "total_calls": number,
      "analyzed": number,
      "calls_with_errors": number,
      "error_rate_pct": number,
      "total_errors": number,
      "critical_errors": number,
      "top_errors": string[]       // Up to 3 most common error types for this agent
    }
  ]

Examples:
  - "Which agent has the highest error rate?" → use this tool, compare error_rate_pct
  - "What are Debt Collector's most common mistakes?" → use this tool, read top_errors for Debt Collector

Error Handling:
  - Returns empty array if no analyzed calls exist`,
        inputSchema: z.object({
            response_format: ResponseFormat,
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ response_format }) => {
        try {
            const db = getSupabase();
            const { data: calls } = await db
                .from('ultravox_calls')
                .select('client_name, analysis_status, error_count, critical_error_count, call_errors')
                .range(0, 9999);
            const agentMap = new Map();
            for (const call of calls ?? []) {
                const name = call.client_name || 'Unknown';
                if (!agentMap.has(name)) {
                    agentMap.set(name, { total_calls: 0, analyzed: 0, calls_with_errors: 0, total_errors: 0, critical_errors: 0, errorCounts: new Map() });
                }
                const a = agentMap.get(name);
                a.total_calls++;
                if (call.analysis_status === 'complete') {
                    a.analyzed++;
                    const ec = call.error_count ?? 0;
                    const cc = call.critical_error_count ?? 0;
                    if (ec > 0)
                        a.calls_with_errors++;
                    a.total_errors += ec;
                    a.critical_errors += cc;
                    const analysis = call.call_errors;
                    for (const e of analysis?.errors ?? []) {
                        a.errorCounts.set(e.type, (a.errorCounts.get(e.type) ?? 0) + 1);
                    }
                }
            }
            const summary = Array.from(agentMap.entries())
                .map(([agent, a]) => ({
                agent,
                total_calls: a.total_calls,
                analyzed: a.analyzed,
                calls_with_errors: a.calls_with_errors,
                error_rate_pct: a.analyzed > 0 ? Math.round((a.calls_with_errors / a.analyzed) * 100) : 0,
                total_errors: a.total_errors,
                critical_errors: a.critical_errors,
                top_errors: Array.from(a.errorCounts.entries())
                    .sort((x, y) => y[1] - x[1])
                    .slice(0, 3)
                    .map(([type]) => type),
            }))
                .sort((a, b) => b.error_rate_pct - a.error_rate_pct);
            let text;
            if (response_format === 'json') {
                text = JSON.stringify(summary, null, 2);
            }
            else {
                const lines = ['# Voxray — Agent Summary', ''];
                for (const a of summary) {
                    lines.push(`## ${a.agent}`);
                    lines.push(`- Calls: ${a.total_calls} total, ${a.analyzed} analyzed`);
                    lines.push(`- Error Rate: **${a.error_rate_pct}%** (${a.calls_with_errors} calls with errors)`);
                    lines.push(`- Errors: ${a.total_errors} total, ${a.critical_errors} critical`);
                    if (a.top_errors.length > 0)
                        lines.push(`- Top Issues: ${a.top_errors.join(', ')}`);
                    lines.push('');
                }
                text = lines.join('\n');
            }
            return {
                content: [{ type: 'text', text }],
                structuredContent: { agents: summary },
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
//# sourceMappingURL=stats.js.map