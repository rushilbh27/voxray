#!/usr/bin/env node
/**
 * Voxray MCP Server
 * Gives AI agents read access to call intelligence data.
 * Run: npx tsx mcp/server.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import ws from 'ws';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { realtime: { transport: ws as any } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const server = new McpServer({
  name: 'voxray',
  version: '1.0.0',
});

// ── Tool: Dashboard stats ────────────────────────────────────────────────────
server.registerTool(
  'voxray_stats',
  {
    description: 'Get Voxray dashboard stats: total calls, success rate, cost, error rate, analyzed count.',
    inputSchema: {},
  },
  async () => {
    const [
      { count: totalCalls },
      { count: endedCount },
      { count: successfulCount },
      { count: activeCalls },
      { count: totalAnalyzed },
      { count: callsWithErrors },
      { data: aggregateRows },
    ] = await Promise.all([
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true }),
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'ended'),
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true })
        .eq('status', 'ended').not('ended_reason', 'in', '(error,unjoined)'),
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true }).eq('analysis_status', 'complete'),
      supabase.from('ultravox_calls').select('*', { count: 'exact', head: true })
        .gt('error_count', 0).eq('analysis_status', 'complete'),
      supabase.from('ultravox_calls').select('cost_usd, duration_seconds').range(0, 9999),
    ]);

    const totalCost = aggregateRows?.reduce((s, c) => s + (c.cost_usd || 0), 0) || 0;
    const withDuration = aggregateRows?.filter((c) => (c.duration_seconds || 0) > 0) || [];
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, c) => s + (c.duration_seconds || 0), 0) / withDuration.length)
      : 0;
    const successRate = (endedCount ?? 0) > 0
      ? Math.round(((successfulCount ?? 0) / (endedCount ?? 1)) * 100) : 0;
    const errorRate = (totalAnalyzed ?? 0) > 0
      ? Math.round(((callsWithErrors ?? 0) / (totalAnalyzed ?? 1)) * 100) : 0;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          total_calls: totalCalls ?? 0,
          active_calls: activeCalls ?? 0,
          success_rate_pct: successRate,
          total_cost_usd: Math.round(totalCost * 100) / 100,
          avg_duration_seconds: avgDuration,
          total_analyzed: totalAnalyzed ?? 0,
          calls_with_errors: callsWithErrors ?? 0,
          error_rate_pct: errorRate,
        }, null, 2),
      }],
    };
  }
);

// ── Tool: Error leaderboard ──────────────────────────────────────────────────
server.registerTool(
  'voxray_errors',
  {
    description: 'Get error leaderboard: most common agent mistakes, frequency, severity, and actionable fix suggestions for each error type.',
    inputSchema: {
      agent: z.string().optional().describe('Filter by agent name e.g. "Sales AI", "Debt Collector"'),
      limit: z.number().optional().describe('Max error types to return (default 10)'),
    },
  },
  async ({ agent, limit = 10 }) => {
    let query = supabase
      .from('ultravox_calls')
      .select('call_id, client_name, call_errors, error_count, critical_error_count')
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .range(0, 9999);

    if (agent) query = query.eq('client_name', agent);

    const { data: errorCalls } = await query;

    const freqMap = new Map<string, {
      type: string; count: number; critical_count: number;
      agents: string[]; example_call_id: string;
    }>();

    for (const call of errorCalls ?? []) {
      const errors = (call.call_errors as { errors?: Array<{ type: string; severity: string }> } | null)?.errors ?? [];
      for (const err of errors) {
        if (!freqMap.has(err.type)) {
          freqMap.set(err.type, { type: err.type, count: 0, critical_count: 0, agents: [], example_call_id: call.call_id });
        }
        const f = freqMap.get(err.type)!;
        f.count++;
        if (err.severity === 'critical') f.critical_count++;
        if (!f.agents.includes(call.client_name)) f.agents.push(call.client_name);
      }
    }

    const sorted = Array.from(freqMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          calls_with_errors: errorCalls?.length ?? 0,
          errors: sorted,
        }, null, 2),
      }],
    };
  }
);

// ── Tool: Worst calls ────────────────────────────────────────────────────────
server.registerTool(
  'voxray_worst_calls',
  {
    description: 'Get the most problematic calls ranked by critical error count, with summaries.',
    inputSchema: {
      agent: z.string().optional().describe('Filter by agent name'),
      limit: z.number().optional().describe('Number of calls to return (default 10)'),
    },
  },
  async ({ agent, limit = 10 }) => {
    let query = supabase
      .from('ultravox_calls')
      .select('call_id, client_name, call_errors, error_count, critical_error_count, created_at, duration_seconds')
      .eq('analysis_status', 'complete')
      .gt('error_count', 0)
      .order('critical_error_count', { ascending: false })
      .limit(limit);

    if (agent) query = query.eq('client_name', agent);

    const { data: calls } = await query;

    const result = (calls ?? []).map((c) => {
      const analysis = c.call_errors as { summary?: string; goal_achieved?: boolean; goal_outcome?: string; missed_opportunities?: string[] } | null;
      return {
        call_id: c.call_id,
        agent: c.client_name,
        error_count: c.error_count,
        critical_error_count: c.critical_error_count,
        duration_seconds: c.duration_seconds,
        created_at: c.created_at,
        summary: analysis?.summary ?? null,
        goal_achieved: analysis?.goal_achieved ?? null,
        goal_outcome: analysis?.goal_outcome ?? null,
        missed_opportunities: analysis?.missed_opportunities ?? [],
      };
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ── Tool: Call detail ────────────────────────────────────────────────────────
server.registerTool(
  'voxray_call_detail',
  {
    description: 'Get full transcript and error analysis for a specific call. Use this to understand exactly what went wrong.',
    inputSchema: {
      call_id: z.string().describe('The call UUID'),
    },
  },
  async ({ call_id }) => {
    const [{ data: call }, { data: messages }] = await Promise.all([
      supabase.from('ultravox_calls').select('*').eq('call_id', call_id).single(),
      supabase.from('ultravox_messages').select('role, text, ordinal').eq('call_id', call_id).order('ordinal'),
    ]);

    if (!call) return { content: [{ type: 'text' as const, text: 'Call not found' }] };

    const analysis = call.call_errors as { errors?: unknown[]; goal_achieved?: boolean; goal_outcome?: string; summary?: string; missed_opportunities?: string[] } | null;
    const transcript = (messages ?? []).map((m) => {
      const role = m.role.includes('AGENT') || m.role === 'agent' ? 'agent' : m.role.includes('TOOL') ? 'tool' : 'user';
      return `[${m.ordinal}] ${role}: ${m.text}`;
    }).join('\n');

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          call_id: call.call_id,
          agent: call.client_name,
          status: call.status,
          ended_reason: call.ended_reason,
          duration_seconds: call.duration_seconds,
          created_at: call.created_at,
          analysis: analysis ? {
            goal_achieved: analysis.goal_achieved,
            goal_outcome: analysis.goal_outcome,
            summary: analysis.summary,
            missed_opportunities: analysis.missed_opportunities,
            errors: analysis.errors,
          } : null,
          transcript,
        }, null, 2),
      }],
    };
  }
);

// ── Tool: Analyze call ───────────────────────────────────────────────────────
server.registerTool(
  'voxray_analyze_call',
  {
    description: 'Trigger Claude Haiku error analysis on a specific call. Returns the analysis result.',
    inputSchema: {
      call_id: z.string().describe('The call UUID to analyze'),
      force: z.boolean().optional().describe('Re-analyze even if already analyzed'),
    },
  },
  async ({ call_id, force = false }) => {
    const { detectAgentType, analyzeCallErrors } = await import('../src/lib/error-analyzer.js');

    const { data: call } = await supabase
      .from('ultravox_calls')
      .select('call_id, client_name, analysis_status')
      .eq('call_id', call_id)
      .single();

    if (!call) return { content: [{ type: 'text' as const, text: 'Call not found' }] };
    if (call.analysis_status === 'complete' && !force) {
      return { content: [{ type: 'text' as const, text: 'Already analyzed. Pass force=true to re-analyze.' }] };
    }

    const { data: messages } = await supabase
      .from('ultravox_messages')
      .select('role, text, ordinal')
      .eq('call_id', call_id)
      .order('ordinal');

    const agentType = detectAgentType(call.client_name);
    const analysis = await analyzeCallErrors(messages ?? [], agentType);

    await supabase.from('ultravox_calls').update({
      call_errors: analysis,
      analysis_status: 'complete',
      error_count: analysis.error_count,
      critical_error_count: analysis.critical_error_count,
    }).eq('call_id', call_id);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(analysis, null, 2) }],
    };
  }
);

// ── Tool: Sync calls ─────────────────────────────────────────────────────────
server.registerTool(
  'voxray_sync',
  {
    description: 'Pull the latest 100 calls from Ultravox into Voxray and auto-analyze new ones.',
    inputSchema: {},
  },
  async () => {
    const baseUrl = process.env.VOXRAY_URL ?? 'https://voxray.vercel.app';
    const res = await fetch(`${baseUrl}/api/sync`, { method: 'POST' });
    const data = await res.json() as Record<string, unknown>;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
