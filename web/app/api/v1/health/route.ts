import { ok } from '@/lib/http';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return ok({
    service: 'sanxaydung-api',
    version: 'v1',
    supabase_configured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    time: new Date().toISOString(),
  });
}
