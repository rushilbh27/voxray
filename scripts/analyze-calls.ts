/**
 * Batch error analysis for existing calls.
 * Usage:
 *   npm run analyze              — analyze calls missing analysis (new only)
 *   npm run analyze -- --force   — re-analyze all completed calls
 *   npm run analyze -- --limit 50 — cap how many to process
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { analyzeCallErrors, detectAgentType } from '../src/lib/error-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws as unknown as typeof WebSocket } }
);

const force = process.argv.includes('--force');
const limitArg = process.argv.findIndex(a => a === '--limit');
const limit = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : 500;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`Mode: ${force ? 'FORCE re-analyze all' : 'new only'} | limit: ${limit}\n`);

  // Get calls that have messages but no analysis (or force all)
  let query = supabase
    .from('ultravox_calls')
    .select('call_id, client_name, analysis_status')
    .eq('status', 'ended')
    .gt('duration_seconds', 10)
    .neq('ended_reason', 'unjoined')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!force) {
    query = query.or('analysis_status.is.null,analysis_status.eq.pending,analysis_status.eq.error');
  }

  const { data: calls } = await query;
  if (!calls?.length) {
    console.log('Nothing to analyze.');
    return;
  }

  // Only analyze calls that have messages
  const { data: msgData } = await supabase
    .from('ultravox_messages')
    .select('call_id');
  const callsWithMsgs = new Set((msgData ?? []).map(m => m.call_id));

  const toAnalyze = calls.filter(c => callsWithMsgs.has(c.call_id));
  console.log(`Found ${toAnalyze.length} calls to analyze (${calls.length - toAnalyze.length} skipped — no messages)\n`);

  let done = 0;
  let errors = 0;

  for (const call of toAnalyze) {
    try {
      const { data: messages } = await supabase
        .from('ultravox_messages')
        .select('role, text, ordinal')
        .eq('call_id', call.call_id)
        .order('ordinal', { ascending: true });

      const agentType = detectAgentType(call.client_name);
      const analysis = await analyzeCallErrors(messages ?? [], agentType);

      await supabase
        .from('ultravox_calls')
        .update({
          call_errors: analysis,
          analysis_status: 'complete',
          error_count: analysis.error_count,
          critical_error_count: analysis.critical_error_count,
        })
        .eq('call_id', call.call_id);

      done++;
      const errLabel = analysis.error_count > 0
        ? ` ⚠ ${analysis.critical_error_count} critical, ${analysis.error_count} total`
        : ' ✓ clean';
      console.log(`[${done}/${toAnalyze.length}] ${call.call_id.substring(0, 8)} (${call.client_name})${errLabel}`);

      // Rate limit: ~3 req/s
      await sleep(400);
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

  console.log(`\nDone: ${done} analyzed, ${errors} errors`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
