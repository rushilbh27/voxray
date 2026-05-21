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
import { FIX_SPECS } from '@/lib/fix-specs';

const ULTRAVOX_API = 'https://api.ultravox.ai/api';

// HARD ALLOWLIST — never expand without explicit operator consent
const ALLOWED_AGENTS: Record<string, string> = {
  '428d7591-3ba5-4b60-8aa5-a92012d12451': 'NECTOR Demo',
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

  // ── Apply all patches for this error type ─────────────────────────────────
  let newPrompt = currentPrompt;
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const patch of spec.patches) {
    if (newPrompt.includes(patch.find)) {
      newPrompt = newPrompt.replace(patch.find, patch.replace);
      applied.push(patch.label);
    } else {
      skipped.push(patch.label);
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

  return NextResponse.json({
    ok:            true,
    agent:         agentName,
    error_type:    errorType,
    applied,
    skipped,
    new_hash:      newHash,
    prompt_length: newPrompt.length,
  });
}
