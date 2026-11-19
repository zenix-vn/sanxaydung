import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';

import type { MyCompany } from '@/lib/roles';
export { canEdit, canAdmin } from '@/lib/roles';
export type { MyCompany } from '@/lib/roles';

/** Người dùng hiện tại + các doanh nghiệp họ đang là thành viên (Server Component). */
export async function getMe(): Promise<{ userId: string | null; companies: MyCompany[] }> {
  if (!SUPABASE_URL) return { userId: null, companies: [] };
  try {
    const supa = createSupabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return { userId: null, companies: [] };
    const { data } = await supa
      .from('company_members')
      .select('role, companies ( id, name, slug, logo_url )')
      .eq('user_id', user.id)
      .eq('status', 'active');
    const companies = ((data ?? []) as unknown as { role: string; companies: Omit<MyCompany, 'role'> | null }[])
      .filter((r) => r.companies)
      .map((r) => ({ ...r.companies!, role: r.role }));
    return { userId: user.id, companies };
  } catch {
    return { userId: null, companies: [] };
  }
}
