/**
 * POST /api/agents/[agentId]/apply-fix
 *
 * Applies a Find→Replace patch to an agent's systemPrompt.
 * SAFETY GATE: Only NECTOR_DEMO_TEST (428d7591) is allowed. All production
 * agents are hard-blocked. This route explicitly breaks the read-only Ultravox
 * rule — authorized by operator for demo agent only.
 *
 * Flow:
 *   1. Auth check (Supabase session)
 *   2. Hard-block non-demo agents
 *   3. GET full agent from Ultravox (preserves all settings)
 *   4. Apply all patches for errorType
 *   5. PATCH back with full callTemplate, only systemPrompt changed
 *   6. Auto-log to prompt_fixes
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { FIX_SPECS, verifyPatch } from '@/lib/fix-specs';

const ULTRAVOX_API = 'https://api.ultravox.ai/api';

// HARD ALLOWLIST — never expand without explicit operator consent
const ALLOWED_AGENTS: Record<string, string> = {
  '428d7591-3ba5-4b60-8aa5-a92012d12451': 'NECTOR Demo',
  '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81': 'Davansh_Investment_inbound',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId } = await params;

  // ── Safety gate ───────────────────────────────────────────────────────────
  const agentName = ALLOWED_AGENTS[agentId];
  if (!agentName) {
    return NextResponse.json({
      error: `Agent ${agentId} not in allowlist. Only NECTOR_DEMO_TEST is permitted for auto-fix.`,
    }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { errorType: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { errorType, description } = body;
  if (!errorType) return NextResponse.json({ error: 'errorType required' }, { status: 400 });

  const spec = FIX_SPECS[errorType];
  if (!spec || spec.patches.length === 0) {
    return NextResponse.json({ error: `No patches defined for error type: ${errorType}` }, { status: 404 });
  }

  // ── GET current agent (preserve ALL settings) ─────────────────────────────
  const getRes = await fetch(`${ULTRAVOX_API}/agents/${agentId}`, {
    headers: { 'X-API-Key': process.env.ULTRAVOX_API_KEY! },
  });
  if (!getRes.ok) {
    return NextResponse.json({
      error: `GET agent failed: ${getRes.status} ${await getRes.text()}`,
    }, { status: 502 });
  }
  const agent = await getRes.json();
  const currentPrompt: string = agent.callTemplate?.systemPrompt ?? '';

  // ── Pre-flight: verify at least one patch find-text exists ─────────────────
  const verifications = spec.patches.map((patch) => ({
    patch,
    ...verifyPatch(patch, currentPrompt),
  }));
  const anyExists = verifications.some((v) => v.exists);

  if (!anyExists) {
    return NextResponse.json({
      error: `No patch find-text found in ${agentName} prompt. These patches may be designed for a different agent.`,
      patches: verifications.map((v) => ({
        label: v.patch.label,
        exists: v.exists,
        lineNumber: v.lineNumber,
      })),
    }, { status: 409 });
  }

  // ── Apply all patches for this error type ─────────────────────────────────
  let newPrompt = currentPrompt;
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const v of verifications) {
    if (v.exists && newPrompt.includes(v.patch.find)) {
      newPrompt = newPrompt.replace(v.patch.find, v.patch.replace);
      applied.push(v.patch.label);
    } else {
      skipped.push(v.patch.label);
    }
  }

  if (applied.length === 0) {
    return NextResponse.json({
      error: 'All patches already applied — find text not found in current prompt.',
      skipped,
    }, { status: 409 });
  }

  // ── PATCH back — FULL callTemplate preserved, only systemPrompt changed ──
  const patchBody = {
    callTemplate: {
      ...agent.callTemplate,
      systemPrompt: newPrompt,
    },
  };

  const patchRes = await fetch(`${ULTRAVOX_API}/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'X-API-Key': process.env.ULTRAVOX_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    return NextResponse.json({
      error: `PATCH agent failed: ${patchRes.status} ${errText}`,
    }, { status: 502 });
  }

  // ── Auto-log fix ──────────────────────────────────────────────────────────
  const fixDescription = description || `Auto-applied: ${applied.join(', ')}`;
  void supabaseAdmin.from('prompt_fixes').insert({
    agent:       agentName,
    error_type:  errorType,
    description: fixDescription,
    applied_at:  new Date().toISOString(),
  });

  // ── Compute new prompt hash ───────────────────────────────────────────────
  const { createHash } = await import('crypto');
  const newHash = createHash('sha256').update(newPrompt).digest('hex');

  // ── Trigger re-analysis of last 15 calls to confirm fix worked ───────────
  // Fire-and-forget: don't block the response. Uses same logic as /reanalyze route.
  import('@/lib/supabase').then(async ({ supabaseAdmin: db }) => {
    const { data: recentCalls } = await db
      .from('ultravox_calls')
      .select('call_id')
      .eq('agent_id', agentId)
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(15);

    if (!recentCalls || recentCalls.length === 0) return;

    const callIds = recentCalls.map((c) => c.call_id as string);
    await db
      .from('ultravox_calls')
      .update({ analysis_status: 'pending' })
      .in('call_id', callIds);

    const { analyzeCall } = await import('@/lib/call-analyzer');
    const webhookUrl = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;
    const concurrency = 2;
    const queue = [...callIds];

    async function reprocessOne(callId: string) {
      try {
        await db.from('ultravox_calls').update({ analysis_status: 'analyzing' }).eq('call_id', callId);
        const { data: msgs } = await db
          .from('ultravox_messages')
          .select('role, text, ordinal')
          .eq('call_id', callId)
          .order('ordinal', { ascending: true });
        if (!msgs || msgs.length < 4) {
          await db.from('ultravox_calls').update({ analysis_status: 'skipped' }).eq('call_id', callId);
          return;
        }
        const result = await analyzeCall({ callId, agentId, clientName: agentName, messages: msgs, webhookUrl });
        await db.from('ultravox_calls').update({
          call_errors: result.analysis,
          analysis_status: 'complete',
          error_count: result.analysis.error_count,
          critical_error_count: result.analysis.critical_error_count,
          prompt_hash: result.prompt_hash ?? null,
        }).eq('call_id', callId);
      } catch {
        await db.from('ultravox_calls').update({ analysis_status: 'error' }).eq('call_id', callId).then(() => null, () => null);
      }
    }

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      await Promise.all(batch.map(reprocessOne));
    }
  }).catch(() => {});

  return NextResponse.json({
    ok:              true,
    agent:           agentName,
    error_type:      errorType,
    applied,
    skipped,
    new_hash:        newHash,
    prompt_length:   newPrompt.length,
    reanalyze_queued: true,
  });
}
