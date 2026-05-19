import { NextResponse } from 'next/server';

export function checkApiKey(request: Request): NextResponse | null {
  const key = process.env.VOXRAY_API_KEY;
  if (!key) return null; // no key configured → open (dev mode)

  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');
  const provided = authHeader?.replace('Bearer ', '') ?? apiKeyHeader ?? '';

  if (provided !== key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
