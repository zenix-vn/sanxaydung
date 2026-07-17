import { ok, fail } from '@/lib/http';
import { supabaseFromRequest } from '@/lib/supabase/api';

export const dynamic = 'force-dynamic';

// GET /api/v1/companies/[slug] — hồ sơ đầy đủ (danh mục, khu vực, dự án, trust score)
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const supa = supabaseFromRequest(req);
    const { data, error } = await supa
      .from('companies')
      .select(
        `*,
         company_categories ( categories (*) ),
         company_locations ( provinces (*) ),
         projects ( * ),
         trust_scores ( score, breakdown )`,
      )
      .eq('slug', params.slug)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail('Không tìm thấy doanh nghiệp', 404);
    return ok(data);
  } catch (e) {
    return fail((e as Error).message, 500);
  }
}
