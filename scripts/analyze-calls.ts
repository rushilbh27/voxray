/**
 * Batch call analysis.
 * Primary: Claude Haiku (sync, authoritative error detection)
 * Enrichment: Llama fires in background per call (transcript + names via webhook)
 *
 * Usage:
 *   npm run analyze              — analyze calls missing analysis
 *   npm run analyze -- --force   — re-analyze all completed calls
 *   npm run analyze -- --limit 50
 */
import { readFileSync } from 'fs';
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 1 || line.trim().startsWith('#')) continue;
    const key = line.substring(0, eq).trim();
    const val = line.substring(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env.local not found */ }

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { analyzeCall } from '../src/lib/call-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

const force = process.argv.includes('--force');
const limitArg = process.argv.findIndex(a => a === '--limit');
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : 500;
const CONCURRENCY = 2; // Haiku rate limit: 50k tokens/min — large transcripts need headroom
const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

const counters = { done: 0, errors: 0, total: 0 };

async function processCall(call: { call_id: string; client_name: string; agent_id?: string | null }) {
  try {
    await supabase
      .from('ultravox_calls')
      .update({ analysis_status: 'analyzing' })
      .eq('call_id', call.call_id);

    const { data: messages } = await supabase
      .from('ultravox_messages')
      .select('role, text, ordinal')
      .eq('call_id', call.call_id)
      .order('ordinal', { ascending: true });

    const result = await analyzeCall({
      callId: call.call_id,
      agentId: call.agent_id ?? null,
      clientName: call.client_name ?? '',
      messages: messages ?? [],
      webhookUrl: WEBHOOK_URL,
    });

    await supabase
      .from('ultravox_calls')
      .update({
        call_errors:          result.analysis,
        analysis_status:      'complete',
        error_count:          result.analysis.error_count,
        critical_error_count: result.analysis.critical_error_count,
        prompt_hash:          result.prompt_hash ?? null,
      })
      .eq('call_id', call.call_id);

    counters.done++;
    const label = result.analysis.error_count > 0
      ? ` ⚠ ${result.analysis.critical_error_count}c / ${result.analysis.error_count} errors`
      : ' ✓ clean';
    process.stdout.write(`[${counters.done}/${counters.total}] ${call.call_id.substring(0, 8)} (${call.client_name})${label}\n`);
  } catch (err) {
    counters.errors++;
    console.error(`  ✗ ${call.call_id.substring(0, 8)}: ${(err as Error).message}`);
    await supabase
      .from('ultravox_calls')
      .update({ analysis_status: 'error' })
      .eq('call_id', call.call_id);
  }
}

async function main() {
  console.log(`Mode: ${force ? 'FORCE' : 'new only'} | limit: ${limit} | concurrency: ${CONCURRENCY}\n`);

  let query = supabase
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status')
    .eq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!force) {
    query = query.or('analysis_status.is.null,analysis_status.eq.pending,analysis_status.eq.error');
  }

  const { data: calls } = await query;
  if (!calls?.length) { console.log('Nothing to analyze.'); return; }

  // Claim ALL calls atomically before processing — prevents two terminals re-doing same work
  await supabase
    .from('ultravox_calls')
    .update({ analysis_status: 'analyzing' })
    .in('call_id', calls.map(c => c.call_id));

  counters.total = calls.length;
  console.log(`Found ${calls.length} calls — processing ${CONCURRENCY} at a time\n`);

  for (let i = 0; i < calls.length; i += CONCURRENCY) {
    await Promise.all(calls.slice(i, i + CONCURRENCY).map(processCall));
  }

  console.log(`\nDone: ${counters.done} analyzed, ${counters.errors} errors`);
  console.log(`Llama enrichment (transcript/names) arriving via webhook in background.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
