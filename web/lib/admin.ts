import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import { hasRole, type PlatformRole } from '@/lib/admin-roles';
export { hasRole, ROLE_LABEL, type PlatformRole } from '@/lib/admin-roles';

export interface AdminStats {
  companies_total: number; companies_published: number; companies_suspended: number;
  companies_unclaimed: number; companies_verified: number;
  users_total: number; users_7d: number; listings_open: number; quotes_total: number;
  posts_total: number; connections_completed: number; reviews_total: number; subs_active: number;
  verifications_pending: number; claims_pending: number; reports_open: number; registrations_pending: number;
  series: { day: string; users: number; companies: number; listings: number }[];
}

/** Chặn truy cập: chưa đăng nhập → /login; không đủ quyền → 404 (không lộ sự tồn tại của /admin). */
export async function requireAdmin(redirectTo = '/admin', min: PlatformRole = 'moderator') {
  if (!SUPABASE_URL) notFound();
  const supa = createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  const { data: r } = await supa.rpc('platform_role');
  const role = (r as PlatformRole | null) ?? null;
  if (!role || !hasRole(role, min)) notFound();
  const { data: profile } = await supa.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle();
  return {
    supa,
    user,
    role,
    name: (profile as { full_name: string | null } | null)?.full_name || user.email || 'Quản trị viên',
    email: user.email ?? '',
  };
}

export const PAGE_SIZE = 20;

export function pageOf(sp: { page?: string }) {
  const page = Math.max(1, Number(sp.page) || 1);
  return { page, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 };
}

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  const timeZone = 'Asia/Ho_Chi_Minh'; // máy chủ chạy UTC
  return withTime
    ? d.toLocaleString('vi-VN', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('vi-VN', { timeZone });
}
