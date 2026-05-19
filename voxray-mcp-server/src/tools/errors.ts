import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSupabase } from '../services/supabase.js';
import { humanLabel, fixSuggestion } from '../services/labels.js';
import { CHARACTER_LIMIT, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants.js';
import type { ErrorFrequency, PaginatedResult } from '../types.js';

const ResponseFormat = z.enum(['markdown', 'json']).default('markdown');

export function registerErrorTools(server: McpServer): void {

  server.registerTool(
    'voxray_list_errors',
    {
      title: 'List Error Leaderboard',
      description: `Get the leaderboard of most common agent mistakes across all analyzed calls, ranked by frequency.

Each error entry includes a human-readable label, raw error type code, frequency count, critical count, which agents trigger it, an example call ID, and a specific actionable fix suggestion referencing the actual agent prompt rules.

Use this to understand what to fix in agent prompts and which error types are most damaging.

Args:
  - agent (string, optional): Filter to a specific agent name (e.g. "Sales AI", "Debt Collector", "Cold Outreach")
  - limit (number): Max error types to return, 1-50 (default: 20)
  - offset (number): Skip N error types for pagination (default: 0)
  - include_fix (boolean): Include prompt fix suggestions (default: true)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (JSON format):
  {
    "total_analyzed": number,
    "calls_with_errors": number,
    "total": number,          // Total distinct error types
    "count": number,          // Error types in this response
    "offset": number,
    "has_more": boolean,
    "next_offset": number,
    "errors": [
      {
        "type": string,           // Raw error code (e.g. "accepted_garbled_audio")
        "human_label": string,    // Human readable (e.g. "Accepted unclear audio as a valid answer")
        "count": number,          // Total occurrences across all calls
        "critical_count": number, // Occurrences where severity = critical
        "agents": string[],       // Agent names this error appears in
        "example_call_id": string,// A call ID where this error occurred
        "fix_suggestion": string | null  // Prompt fix to address this error
      }
    ]
  }

Examples:
  - "What are the most common agent mistakes?" → use this tool with defaults
  - "What errors does the Debt Collector make?" → use this tool with agent="Debt Collector"
  - "How do I fix the no_save_answers error?" → use this tool, read fix_suggestion for that type

Error Handling:
  - Returns empty errors array if no calls have been analyzed yet
  - Run \`npm run analyze\` in voxray project to trigger analysis`,
      inputSchema: z.object({
        agent: z.string().optional().describe('Filter by agent name e.g. "Sales AI", "Debt Collector", "Cold Outreach"'),
        limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
          .describe('Max error types to return (default: 20)'),
        offset: z.number().int().min(0).default(0).describe('Skip N error types for pagination'),
        include_fix: z.boolean().default(true).describe('Include prompt fix suggestions (default: true)'),
        response_format: ResponseFormat,
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ agent, limit, offset, include_fix, response_format }) => {
      try {
        const db = getSupabase();

        let query = db
          .from('ultravox_calls')
          .select('call_id, client_name, call_errors, error_count, critical_error_count')
          .eq('analysis_status', 'complete')
          .gt('error_count', 0)
          .range(0, 9999);

        if (agent) query = query.eq('client_name', agent);

        const [{ data: errorCalls }, { count: totalAnalyzed }] = await Promise.all([
          query,
          db.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
        ]);

        const freqMap = new Map<string, ErrorFrequency>();
        for (const call of errorCalls ?? []) {
          const errors = (call.call_errors as { errors?: Array<{ type: string; severity: string }> } | null)?.errors ?? [];
          for (const err of errors) {
            if (!freqMap.has(err.type)) {
              freqMap.set(err.type, {
                type: err.type,
                human_label: humanLabel(err.type),
                count: 0,
                critical_count: 0,
                fix_suggestion: include_fix ? fixSuggestion(err.type) : null,
                agents: [],
                example_call_id: call.call_id as string,
              });
            }
            const f = freqMap.get(err.type)!;
            f.count++;
            if (err.severity === 'critical') f.critical_count++;
            if (!f.agents.includes(call.client_name as string)) f.agents.push(call.client_name as string);
          }
        }

        const allErrors = Array.from(freqMap.values()).sort((a, b) => b.count - a.count);
        const paginated = allErrors.slice(offset, offset + limit);
        const hasMore = offset + limit < allErrors.length;

        const result: PaginatedResult<ErrorFrequency> & {
          total_analyzed: number;
          calls_with_errors: number;
        } = {
          total_analyzed: totalAnalyzed ?? 0,
          calls_with_errors: errorCalls?.length ?? 0,
          total: allErrors.length,
          count: paginated.length,
          offset,
          items: paginated,
          has_more: hasMore,
          ...(hasMore ? { next_offset: offset + limit } : {}),
        };

        let text: string;
        if (response_format === 'json') {
          text = JSON.stringify({ ...result, errors: result.items }, null, 2);
        } else {
          const lines = [
            '# Voxray — Error Leaderboard',
            '',
            `${result.calls_with_errors} calls with errors · ${allErrors.length} error types · ${result.total_analyzed} analyzed`,
            '',
          ];
          paginated.forEach((err, i) => {
            const rank = offset + i + 1;
            const critBadge = err.critical_count > 0 ? ` ⚠ ${err.critical_count} critical` : '';
            lines.push(`## ${rank}. ${err.human_label}`);
            lines.push(`\`${err.type}\` · **${err.count}** occurrences${critBadge}`);
            lines.push(`Agents: ${err.agents.join(', ')}`);
            lines.push(`Example: \`${err.example_call_id}\``);
            if (err.fix_suggestion) {
              lines.push(`**Fix:** ${err.fix_suggestion}`);
            }
            lines.push('');
          });
          if (hasMore) lines.push(`_${allErrors.length - offset - limit} more error types — use offset=${offset + limit} to see next page_`);
          text = lines.join('\n');
        }

        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) + '\n\n_[Response truncated — use offset or limit to paginate]_';
        }

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: { ...result, errors: result.items },
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        };
      }
    }
  );
}
