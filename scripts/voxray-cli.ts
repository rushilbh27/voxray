#!/usr/bin/env node
/**
 * Voxray CLI
 * Usage: npx tsx scripts/voxray-cli.ts <command> [options]
 *
 * Commands:
 *   stats                          Dashboard metrics
 *   errors [--agent X] [--limit N] Error leaderboard with fix suggestions
 *   calls  [--agent X] [--page N] [--errors-only]  Paginated call list
 *   call   <id>                    Full transcript + errors for one call
 *   analyze <id> [--force]         Run Claude Haiku analysis on a call
 *   sync                           Pull latest calls from Ultravox
 *   monitor [--interval 60]        Poll for new critical errors + print alerts
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';

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
const BASE_URL = process.env.VOXRAY_URL ?? 'http://localhost:3000';

const program = new Command();
program.name('voxray').description('Voxray CLI — call intelligence for voice agents').version('1.0.0');

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, unit = '') {
  return chalk.bold(String(n ?? 0)) + (unit ? chalk.dim(unit) : '');
}

function severityColor(s: string) {
  if (s === 'critical') return chalk.red(s);
  if (s === 'major') return chalk.yellow(s);
  return chalk.dim(s);
}

// ── stats ────────────────────────────────────────────────────────────────────
program
  .command('stats')
  .description('Dashboard metrics')
  .action(async () => {
    const res = await fetch(`${BASE_URL}/api/v1/stats`);
    const d = await res.json() as Record<string, number>;
    console.log('\n' + chalk.bold.cyan('Voxray — Stats'));
    console.log(chalk.dim('─'.repeat(36)));
    console.log(`Total Calls     ${fmt(d.total_calls)}`);
    console.log(`Active Now      ${fmt(d.active_calls)}`);
    console.log(`Success Rate    ${fmt(d.success_rate_pct, '%')}`);
    console.log(`Total Cost      ${chalk.bold('$' + (d.total_cost_usd ?? 0).toFixed(2))}`);
    console.log(`Avg Duration    ${fmt(Math.floor((d.avg_duration_seconds ?? 0) / 60), 'm ')}${fmt((d.avg_duration_seconds ?? 0) % 60, 's')}`);
    console.log(chalk.dim('─'.repeat(36)));
    console.log(`Analyzed        ${fmt(d.total_analyzed)} / ${fmt(d.total_calls)}`);
    console.log(`Calls w/ Errors ${fmt(d.calls_with_errors)}`);
    console.log(`Error Rate      ${d.error_rate_pct > 50 ? chalk.red(d.error_rate_pct + '%') : chalk.yellow(d.error_rate_pct + '%')}`);
    console.log();
  });

// ── errors ───────────────────────────────────────────────────────────────────
program
  .command('errors')
  .description('Error leaderboard with fix suggestions')
  .option('-a, --agent <name>', 'Filter by agent name')
  .option('-l, --limit <n>', 'Max error types', '15')
  .option('--no-fix', 'Hide fix suggestions')
  .action(async (opts) => {
    const params = new URLSearchParams({ limit: opts.limit });
    if (opts.agent) params.set('agent', opts.agent);
    const res = await fetch(`${BASE_URL}/api/v1/errors?${params}`);
    const d = await res.json() as {
      total_analyzed: number;
      calls_with_errors: number;
      errors: Array<{ type: string; human_label: string; count: number; critical_count: number; fix_suggestion: string | null; agents: string[]; example_call_id: string }>;
    };

    console.log('\n' + chalk.bold.cyan('Voxray — Error Intelligence'));
    console.log(chalk.dim(`${d.calls_with_errors} calls with errors · ${d.errors.length} error types · ${d.total_analyzed} analyzed`));
    console.log();

    d.errors.forEach((err, i) => {
      const rank = chalk.dim(`${i + 1}.`);
      const label = chalk.bold(err.human_label);
      const code = chalk.dim(`(${err.type})`);
      const count = chalk.bold.white(String(err.count));
      const crit = err.critical_count > 0 ? chalk.red(` ⚠ ${err.critical_count} critical`) : '';
      console.log(`${rank} ${label} ${code}`);
      console.log(`   ${count} occurrences${crit} · agents: ${chalk.dim(err.agents.join(', '))}`);
      if (opts.fix !== false && err.fix_suggestion) {
        const lines = err.fix_suggestion.match(/.{1,90}(\s|$)/g) ?? [err.fix_suggestion];
        console.log(chalk.blue('   Fix: ') + chalk.cyan(lines[0]?.trim()));
        lines.slice(1).forEach((l) => console.log('        ' + chalk.cyan(l.trim())));
      }
      console.log();
    });
  });

// ── calls ────────────────────────────────────────────────────────────────────
program
  .command('calls')
  .description('Paginated call list')
  .option('-a, --agent <name>', 'Filter by agent')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-l, --limit <n>', 'Calls per page', '20')
  .option('-e, --errors-only', 'Only calls with errors')
  .action(async (opts) => {
    const params = new URLSearchParams({ page: opts.page, limit: opts.limit });
    if (opts.agent) params.set('agent', opts.agent);
    if (opts.errorsOnly) params.set('has_errors', 'true');
    const res = await fetch(`${BASE_URL}/api/v1/calls?${params}`);
    const d = await res.json() as {
      calls: Array<{ call_id: string; agent: string; status: string; ended_reason: string; duration_seconds: number; cost_usd: number; error_count: number; critical_error_count: number; analysis_status: string; created_at: string }>;
      total: number; page: number; pages: number;
    };

    console.log('\n' + chalk.bold.cyan(`Voxray — Calls (page ${d.page}/${d.pages}, ${d.total} total)`));
    console.log();
    for (const c of d.calls) {
      const dur = `${Math.floor((c.duration_seconds || 0) / 60)}m${(c.duration_seconds || 0) % 60}s`;
      const errBadge = c.critical_error_count > 0
        ? chalk.red(` ⚠ ${c.critical_error_count} critical`)
        : c.error_count > 0 ? chalk.yellow(` ! ${c.error_count} errors`) : '';
      const analyzed = c.analysis_status === 'complete' ? chalk.green('✓') : chalk.dim('·');
      console.log(
        `${analyzed} ${chalk.bold(c.agent.padEnd(28))} ${chalk.dim(dur.padEnd(8))} ` +
        `${chalk.dim(c.ended_reason ?? c.status)} ${errBadge}`
      );
      console.log(chalk.dim(`  ${c.call_id}  ${new Date(c.created_at).toLocaleString()}`));
    }
    console.log();
  });

// ── call detail ───────────────────────────────────────────────────────────────
program
  .command('call <id>')
  .description('Full transcript + error analysis for one call')
  .option('--no-transcript', 'Skip transcript, show analysis only')
  .action(async (id, opts) => {
    const res = await fetch(`${BASE_URL}/api/v1/calls/${id}`);
    if (!res.ok) { console.error(chalk.red('Call not found:', id)); process.exit(1); }
    const d = await res.json() as {
      call_id: string; agent: string; status: string; ended_reason: string;
      duration_seconds: number; created_at: string;
      analysis: { goal_achieved: boolean; goal_outcome: string; summary: string; missed_opportunities: string[]; errors: Array<{ type: string; severity: string; agent_line: string; what_went_wrong: string; should_have_said: string }> } | null;
      transcript: Array<{ role: string; text: string; ordinal: number }>;
    };

    const dur = `${Math.floor((d.duration_seconds || 0) / 60)}m ${(d.duration_seconds || 0) % 60}s`;
    console.log('\n' + chalk.bold.cyan(`${d.agent} — ${d.call_id.substring(0, 16)}…`));
    console.log(chalk.dim(`${dur} · ${d.ended_reason} · ${new Date(d.created_at).toLocaleString()}`));

    if (d.analysis) {
      const a = d.analysis;
      const goalIcon = a.goal_achieved ? chalk.green('✓') : chalk.red('✗');
      console.log(`\n${goalIcon} ${chalk.bold('Goal:')} ${a.goal_outcome}`);
      console.log(chalk.dim(a.summary));
      if (a.errors.length > 0) {
        console.log('\n' + chalk.bold.red(`Errors (${a.errors.length}):`));
        for (const e of a.errors) {
          console.log(`  ${severityColor(e.severity).toUpperCase().padEnd(10)} ${chalk.bold(e.type)}`);
          console.log(chalk.dim(`    Agent said: "${e.agent_line}"`));
          console.log(`    ${chalk.red('Problem:')} ${e.what_went_wrong}`);
          console.log(`    ${chalk.green('Should:')}  ${e.should_have_said}`);
          console.log();
        }
      }
      if (a.missed_opportunities.length > 0) {
        console.log(chalk.yellow('Missed opportunities:'));
        a.missed_opportunities.forEach((o) => console.log(chalk.dim(`  • ${o}`)));
      }
    } else {
      console.log(chalk.dim('\nNot analyzed. Run: voxray analyze ' + id));
    }

    if (opts.transcript !== false && d.transcript.length > 0) {
      console.log('\n' + chalk.bold('Transcript:'));
      for (const m of d.transcript) {
        const roleColor = m.role === 'agent' ? chalk.blue : m.role === 'tool' ? chalk.magenta : chalk.white;
        console.log(roleColor(`[${m.ordinal}] ${m.role.toUpperCase()}: `) + m.text);
      }
    }
    console.log();
  });

// ── analyze ───────────────────────────────────────────────────────────────────
program
  .command('analyze <id>')
  .description('Run Claude Haiku analysis on a call')
  .option('--force', 'Re-analyze even if already done')
  .action(async (id, opts) => {
    const { detectAgentType, analyzeCallErrors } = await import('../src/lib/error-analyzer.js');

    console.log(chalk.dim(`Analyzing ${id}…`));
    const { data: call } = await supabase
      .from('ultravox_calls')
      .select('call_id, client_name, analysis_status')
      .eq('call_id', id)
      .single();

    if (!call) { console.error(chalk.red('Call not found')); process.exit(1); }
    if (call.analysis_status === 'complete' && !opts.force) {
      console.log(chalk.yellow('Already analyzed. Use --force to re-run.')); process.exit(0);
    }

    const { data: messages } = await supabase
      .from('ultravox_messages').select('role, text, ordinal').eq('call_id', id).order('ordinal');

    const agentType = detectAgentType(call.client_name);
    const analysis = await analyzeCallErrors(messages ?? [], agentType);

    await supabase.from('ultravox_calls').update({
      call_errors: analysis, analysis_status: 'complete',
      error_count: analysis.error_count, critical_error_count: analysis.critical_error_count,
    }).eq('call_id', id);

    const icon = analysis.goal_achieved ? chalk.green('✓') : chalk.red('✗');
    console.log(`${icon} ${analysis.error_count} errors (${analysis.critical_error_count} critical) — ${analysis.summary}`);
    if (analysis.errors.length > 0) {
      analysis.errors.forEach((e) => console.log(`  ${severityColor(e.severity)} ${chalk.bold(e.type)}: ${e.what_went_wrong}`));
    }
  });

// ── sync ──────────────────────────────────────────────────────────────────────
program
  .command('sync')
  .description('Pull latest calls from Ultravox and auto-analyze new ones')
  .action(async () => {
    console.log(chalk.dim('Syncing…'));
    const res = await fetch(`${BASE_URL}/api/sync`, { method: 'POST' });
    const d = await res.json() as Record<string, unknown>;
    console.log(chalk.green('✓ Done:'), JSON.stringify(d));
  });

// ── monitor ───────────────────────────────────────────────────────────────────
program
  .command('monitor')
  .description('Poll for new critical errors and print alerts')
  .option('-i, --interval <seconds>', 'Poll interval in seconds', '60')
  .option('-a, --agent <name>', 'Watch specific agent only')
  .action(async (opts) => {
    const interval = parseInt(opts.interval, 10) * 1000;
    let lastSeen = new Date().toISOString();

    console.log(chalk.bold.cyan('Voxray Monitor') + chalk.dim(` — polling every ${opts.interval}s`));
    if (opts.agent) console.log(chalk.dim(`Watching: ${opts.agent}`));
    console.log(chalk.dim('Press Ctrl+C to stop\n'));

    const check = async () => {
      let query = supabase
        .from('ultravox_calls')
        .select('call_id, client_name, error_count, critical_error_count, call_errors, created_at')
        .eq('analysis_status', 'complete')
        .gt('critical_error_count', 0)
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: true });

      if (opts.agent) query = query.eq('client_name', opts.agent);

      const { data: newCalls } = await query;
      if (newCalls && newCalls.length > 0) {
        lastSeen = newCalls[newCalls.length - 1].created_at;
        for (const c of newCalls) {
          const analysis = c.call_errors as { summary?: string } | null;
          console.log(
            chalk.red.bold('⚠ CRITICAL ERRORS') +
            chalk.dim(` [${new Date(c.created_at).toLocaleTimeString()}]`) +
            ` ${chalk.bold(c.client_name)} — ${c.critical_error_count} critical, ${c.error_count} total`
          );
          if (analysis?.summary) console.log(chalk.dim(`  ${analysis.summary}`));
          console.log(chalk.dim(`  voxray call ${c.call_id}`));
        }
      } else {
        process.stdout.write(chalk.dim(`[${new Date().toLocaleTimeString()}] no new critical errors\r`));
      }
    };

    await check();
    setInterval(check, interval);
  });

program.parse();
