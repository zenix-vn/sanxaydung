import { NextResponse, type NextRequest } from 'next/server';
import { ACTIVE_CO_COOKIE } from '@/lib/supabase/company';
import { publicOrigin } from '@/lib/origin';

// Chọn doanh nghiệp đang làm việc. Quyền thật vẫn do RLS kiểm tra;
// id không thuộc user sẽ bị requireUserCompany bỏ qua (về công ty mặc định).
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') ?? '';
  const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const res = NextResponse.redirect(new URL(safeNext, publicOrigin(req)));
  if (/^[0-9a-f-]{36}$/i.test(to)) {
    res.cookies.set(ACTIVE_CO_COOKIE, to, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
