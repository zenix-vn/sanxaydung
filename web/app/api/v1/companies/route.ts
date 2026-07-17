import { ok, fail } from '@/lib/http';
import { supabaseFromRequest } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/companies
 *   ?q=          từ khóa (FTS tiếng Việt, không dấu)
 *   ?category=   slug danh mục (vd: tong-thau)
 *   ?province=   mã tỉnh (vd: 01)
 *   ?verified=   true để chỉ lấy đã xác minh
 *   ?limit= &offset=
 */
export async function GET(req: Request) {
  try {
    const supa = supabaseFromRequest(req);
    const sp = new URL(req.url).searchParams;
    const q = sp.get('q');
    const categorySlug = sp.get('category');
    const province = sp.get('province');
    const verified = sp.get('verified') === 'true';
    const limit = Math.min(Number(sp.get('limit') ?? 20), 50);
    const offset = Number(sp.get('offset') ?? 0);

    // slug danh mục -> uuid (RPC nhận uuid)
    let categoryId: string | null = null;
    if (categorySlug) {
      const { data: cat } = await supa
        .from('categories')
        .select('id')
        .eq('slug', categorySlug)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    const { data, error } = await supa.rpc('search_companies', {
      q,
      _category: categoryId,
      _province: province,
      _verified_only: verified,
      _limit: limit,
      _offset: offset,
    });
    if (error) return fail(error.message, 500);
    return ok(data, { limit, offset, count: data?.length ?? 0 });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
