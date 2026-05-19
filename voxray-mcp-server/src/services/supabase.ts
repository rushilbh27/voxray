import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client = createClient(url, key, { realtime: { transport: ws as any } });
  return _client;
}
