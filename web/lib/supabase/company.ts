import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';

export type Membership = { company_id: string; role: 'owner' | 'admin' | 'editor' | 'member' };

/** Lấy user + công ty đầu tiên mà user là thành viên active. Chưa đăng nhập → /login. */
export async function requireUserCompany(redirectPath: string) {
  const supa = createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);

  const { data: membership } = await supa
    .from('company_members')
    .select('company_id, role, companies ( * )')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const company = (membership?.companies as unknown as Record<string, any> | null) ?? null;
  return { supa, user, company, role: (membership?.role ?? null) as Membership['role'] | null };
}
