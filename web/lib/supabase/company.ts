import { cache } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase/server';

export type Membership = { company_id: string; role: 'owner' | 'admin' | 'editor' | 'member' };

/** Cookie ghi nhớ doanh nghiệp đang làm việc (người dùng thuộc nhiều công ty). */
export const ACTIVE_CO_COOKIE = 'sxd_co';

export type CompanyOption = { id: string; name: string; slug: string; logo_url: string | null; role: Membership['role'] };

/**
 * User + doanh nghiệp đang làm việc (theo cookie `sxd_co`, mặc định công ty tham gia sớm nhất)
 * + danh sách mọi công ty user là thành viên active. Chưa đăng nhập → /login.
 */
export async function requireUserCompany(redirectPath: string) {
  const r = await loadUserCompany();
  if (!r.user) redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  return { ...r, user: r.user };
}

// Gom truy vấn trong cùng một request (layout + page cùng gọi).
const loadUserCompany = cache(async () => {
  const supa = createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { supa, user: null, company: null as Record<string, any> | null, role: null as Membership['role'] | null, companies: [] as CompanyOption[] };

  // Một truy vấn: mọi công ty user là thành viên, kèm đủ hồ sơ (trước đây 2 vòng gọi nối tiếp)
  const { data: rows } = await supa
    .from('company_members')
    .select('company_id, role, created_at, companies ( * )')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  const memberships = ((rows ?? []) as unknown as { company_id: string; role: Membership['role']; companies: Record<string, any> | null }[])
    .filter((r) => r.companies);
  const companies: CompanyOption[] = memberships.map((r) => ({
    id: r.companies!.id, name: r.companies!.name, slug: r.companies!.slug, logo_url: r.companies!.logo_url ?? null, role: r.role,
  }));

  const wanted = cookies().get(ACTIVE_CO_COOKIE)?.value;
  const active = memberships.find((m) => m.company_id === wanted) ?? memberships[0];
  const company: Record<string, any> | null = active?.companies ?? null;
  return { supa, user, company, role: (company ? active?.role ?? null : null) as Membership['role'] | null, companies };
});
