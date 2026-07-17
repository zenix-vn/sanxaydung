import { ok, fail } from '@/lib/http';
import { supabaseFromRequest } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

// GET /api/v1/provinces
export async function GET(req: Request) {
  try {
    const supa = supabaseFromRequest(req);
    const { data, error } = await supa.from('provinces').select('*').order('name');
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
