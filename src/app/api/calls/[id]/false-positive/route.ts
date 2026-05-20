import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST — mark an error type on a call as false positive
// Body: { error_type }
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: callId } = await ctx.params;
  const { error_type } = await req.json();

  if (!error_type) {
    return NextResponse.json({ error: 'error_type required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('false_positives')
    .upsert({ call_id: callId, error_type }, { onConflict: 'call_id,error_type' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ marked: true, call_id: callId, error_type });
}

// DELETE — unmark false positive
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { id: callId } = await ctx.params;
  const { error_type } = await req.json();

  await supabaseAdmin
    .from('false_positives')
    .delete()
    .eq('call_id', callId)
    .eq('error_type', error_type);

  return NextResponse.json({ unmarked: true });
}
