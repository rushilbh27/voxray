/**
 * POST /api/agents/[agentId]/reanalyze
 *
 * Marks the last N analyzed calls for an agent as pending, then immediately
 * processes them in the background via after(). Closes the verification gap:
 * apply a prompt fix → hit this → see updated error rates within ~60s.
 *
 * Body: { limit?: number }  (default 30, max 100)
 */
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeCall } from '@/lib/call-analyzer';

// Agent UUID → display name (same map as dashboard)
const AGENT_NAMES: Record<string, string> = {
  '428d7591-3ba5-4b60-8aa5-a92012d12451': 'NECTOR Demo',
  '65ae3d7d-5a1f-4880-89f4-1ce690efae89': 'Sales AI',
  '52db715f-fc68-4265-a354-7f64a27cd3b9': 'Debt Collector',
  '74c435db-0382-45d4-8f84-65343c0dde5f': 'Cold Outreach',
  '4be98966-7c89-4149-8f10-e2ac16291f66': 'Debt Collection 2',
  '3983f5c0-4a95-42e3-a95a-9dbe57e11c78': 'Follow-Up Debt Bot',
  '2dfe90c6-569f-49e0-84f4-e67d9e770255': 'Debt Welcome Bot',
  'bfea3820-a447-4444-bd41-53ff919bbfe3': 'Edifice Properties',
  '5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1': 'Ramco Gas',
  '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81': 'Davansh Investment',
  'efecb97c-2937-4507-a550-8db5e8882c82': 'Real Estate AI',
};

const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId } = await params;
  const clientName = AGENT_NAMES[agentId];
  if (!clientName) {
    return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as { limit?: number };
  const limit = Math.min(Math.max(1, body.limit ?? 30), 100);

  // ── Fetch last N analyzed calls for this agent ────────────────────────────
  const { data: calls, error } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, client_name, agent_id, analysis_status')
    .eq('agent_id', agentId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!calls || calls.length === 0) {
    return NextResponse.json({ queued: 0, message: 'No analyzed calls found for this agent.' });
  }

  // ── Mark them pending so they re-enter the analysis queue ─────────────────
  const callIds = calls.map(c => c.call_id);
  await supabaseAdmin
    .from('ultravox_calls')
    .update({ analysis_status: 'pending' })
    .in('call_id', callIds);

  // ── Process immediately in background (don't wait for cron) ──────────────
  after(async () => {
    const concurrency = 2;
    const queue = [...callIds];

    async function processOne(callId: string) {
      try {
        await supabaseAdmin
          .from('ultravox_calls')
          .update({ analysis_status: 'analyzing' })
          .eq('call_id', callId);

        const { data: messages } = await supabaseAdmin
          .from('ultravox_messages')
          .select('role, text, ordinal')
          .eq('call_id', callId)
          .order('ordinal', { ascending: true });

        if (!messages || messages.length < 4) {
          await supabaseAdmin
            .from('ultravox_calls')
            .update({ analysis_status: 'skipped' })
            .eq('call_id', callId);
          return;
        }

        const result = await analyzeCall({
          callId,
          agentId,
          clientName,
          messages,
          webhookUrl: WEBHOOK_URL,
        });

        await supabaseAdmin
          .from('ultravox_calls')
          .update({
            call_errors:          result.analysis,
            analysis_status:      'complete',
            error_count:          result.analysis.error_count,
            critical_error_count: result.analysis.critical_error_count,
            prompt_hash:          result.prompt_hash ?? null,
          })
          .eq('call_id', callId);
      } catch {
        await supabaseAdmin
          .from('ultravox_calls')
          .update({ analysis_status: 'error' })
          .eq('call_id', callId)
          .then(() => null, () => null);
      }
    }

    // Process concurrency at a time
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      await Promise.all(batch.map(processOne));
    }
  });

  return NextResponse.json({
    ok:      true,
    agent:   clientName,
    queued:  calls.length,
    message: `${calls.length} calls queued for re-analysis. Refresh dashboard in ~60s.`,
  });
}
