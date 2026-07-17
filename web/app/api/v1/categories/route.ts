import { ok, fail } from '@/lib/http';
import { supabaseFromRequest } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

// GET /api/v1/categories?group=contractor|crew|supplier|service
export async function GET(req: Request) {
  try {
    const supa = supabaseFromRequest(req);
    const group = new URL(req.url).searchParams.get('group');
    let query = supa.from('categories').select('*').order('sort_order');
    if (group) query = query.eq('group_key', group);
    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
