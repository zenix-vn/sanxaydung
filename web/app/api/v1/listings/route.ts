import { ok, fail } from '@/lib/http';
import { supabaseFromRequest } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/v1/listings  ?type= &province= &limit= &offset=   (tin đang mở)
 * POST /api/v1/listings  (cần Bearer token; RLS yêu cầu là editor+ của công ty)
 */
export async function GET(req: Request) {
  try {
    const supa = supabaseFromRequest(req);
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(Number(sp.get('limit') ?? 20), 50);
    const offset = Number(sp.get('offset') ?? 0);

    let query = supa
      .from('marketplace_listings')
      .select('*, companies ( name, slug, logo_url, verified_tier )')
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const type = sp.get('type');
    const province = sp.get('province');
    if (type) query = query.eq('type', type);
    if (province) query = query.eq('province_code', province);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);
    return ok(data, { limit, offset, count: data?.length ?? 0 });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const supa = supabaseFromRequest(req);
    const body = await req.json();
    // RLS (listings_write) sẽ chặn nếu token không phải editor+ của company_id
    const { data, error } = await supa
      .from('marketplace_listings')
      .insert(body)
      .select()
      .maybeSingle();
    if (error) return fail(error.message, 403);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
