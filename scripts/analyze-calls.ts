/**
 * Batch call analysis. Primary: Llama audio pipeline. Fallback: Claude Haiku.
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
const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`Mode: ${force ? 'FORCE' : 'new only'} | limit: ${limit} | webhook: ${WEBHOOK_URL}\n`);

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

  console.log(`Found ${calls.length} calls\n`);

  let audioQueued = 0;
  let textDone = 0;
  let errors = 0;

  for (const call of calls) {
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

      if (result.method === 'text') {
        await supabase
          .from('ultravox_calls')
          .update({
            call_errors: result.analysis,
            analysis_status: 'complete',
            error_count: result.analysis.error_count,
            critical_error_count: result.analysis.critical_error_count,
          })
          .eq('call_id', call.call_id);

        textDone++;
        const label = result.analysis.error_count > 0
          ? ` ⚠ ${result.analysis.critical_error_count}c / ${result.analysis.error_count} errors`
          : ' ✓ clean';
        console.log(`[haiku] ${call.call_id.substring(0, 8)} (${call.client_name})${label}`);
      } else {
        audioQueued++;
        console.log(`[llama] ${call.call_id.substring(0, 8)} (${call.client_name}) → queued`);
      }

      await sleep(result.method === 'audio' ? 500 : 400);
    } catch (err) {
      errors++;
      console.error(`  ✗ ${call.call_id.substring(0, 8)}: ${(err as Error).message}`);
      await supabase
        .from('ultravox_calls')
        .update({ analysis_status: 'error' })
        .eq('call_id', call.call_id);
      await sleep(1000);
    }
  }

  console.log(`\n[llama] queued: ${audioQueued} — results arrive via webhook in 1-3 min each`);
  console.log(`[haiku] done:   ${textDone}`);
  if (errors) console.log(`errors: ${errors}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
