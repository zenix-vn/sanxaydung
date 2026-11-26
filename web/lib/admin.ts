import { cache } from 'react';
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
  const a = await loadAdmin();
  if (!a.user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  if (!a.role || !hasRole(a.role, min)) notFound();
  return { ...a, user: a.user, role: a.role };
}

// Layout + trang cùng gọi requireAdmin trong một request → gom về một lần (React cache);
// quyền và hồ sơ lấy song song sau khi xác thực.
const loadAdmin = cache(async () => {
  const supa = createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { supa, user: null, role: null as PlatformRole | null, name: '', email: '' };
  const [{ data: r }, { data: profile }] = await Promise.all([
    supa.rpc('platform_role'),
    supa.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle(),
  ]);
  return {
    supa,
    user,
    role: (r as PlatformRole | null) ?? null,
    name: (profile as { full_name: string | null } | null)?.full_name || user.email || 'Quản trị viên',
    email: user.email ?? '',
  };
});

/** Số liệu tổng (admin_stats) — layout và trang tổng quan dùng chung một lần gọi mỗi request. */
export const getAdminStats = cache(async () => {
  const { supa } = await loadAdmin();
  const { data } = await supa.rpc('admin_stats');
  return (data ?? null) as Partial<AdminStats> | null;
});

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
