import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET — list all fixes (optionally filter by agent or error_type)
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get('agent');
  const errorType = req.nextUrl.searchParams.get('error_type');

  let query = supabaseAdmin
    .from('prompt_fixes')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(100);

  if (agent) query = query.eq('agent_name', agent);
  if (errorType) query = query.eq('error_type', errorType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fixes: data });
}

// POST — log a new prompt fix
export async function POST(req: NextRequest) {
  const { agent_name, error_type, fix_description, applied_at } = await req.json();

  if (!agent_name || !error_type) {
    return NextResponse.json({ error: 'agent_name and error_type required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('prompt_fixes')
    .insert({
      agent_name,
      error_type,
      fix_description: fix_description ?? null,
      applied_at: applied_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fix: data }, { status: 201 });
}
