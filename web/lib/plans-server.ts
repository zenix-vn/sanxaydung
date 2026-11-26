import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import type { Plan } from '@/lib/plans';

const fetchPlans = cachedPublic(async (): Promise<Plan[]> => {
  const { data, error } = await createSupabasePublic().from('plans').select('id, name, price_month, features').order('price_month');
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, price_month: Number(p.price_month ?? 0), features: p.features ?? {} })) as Plan[];
}, 'plans', 60);

export async function getPlans(): Promise<Plan[]> {
  if (!SUPABASE_URL) return [];
  try {
    return await fetchPlans();
  } catch {
    return [];
  }
}
