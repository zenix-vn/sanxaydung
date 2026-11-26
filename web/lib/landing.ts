import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import { slugifyVi } from '@/lib/slug';

export type Pair = { category: string; category_name: string; province: string; province_name: string; total: number };

const fetchPairs = cachedPublic(async (): Promise<Pair[]> => {
  const { data, error } = await createSupabasePublic().rpc('landing_pairs');
  if (error) throw error;
  return (data ?? []) as Pair[];
}, 'landing-pairs', 3600);

/** Các cặp lĩnh vực × tỉnh có doanh nghiệp (rỗng nếu DB lỗi). */
export async function getPairs(): Promise<Pair[]> {
  if (!SUPABASE_URL) return [];
  try {
    return await fetchPairs();
  } catch {
    return [];
  }
}

export const landingPath = (p: Pick<Pair, 'category' | 'province_name'>) => `/linh-vuc/${p.category}/${slugifyVi(p.province_name)}`;
