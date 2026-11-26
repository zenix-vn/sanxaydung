import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/origin';
import { ACTIVE_CO_COOKIE } from '@/lib/supabase/company';

export async function POST(req: Request) {
  await createSupabaseServer().auth.signOut();
  const res = NextResponse.redirect(new URL('/login', publicOrigin(req)), { status: 303 });
  res.cookies.delete(ACTIVE_CO_COOKIE); // máy dùng chung: không giữ công ty của phiên trước
  return res;
}
// Cho phép link GET (nút "Đăng xuất" ở sidebar)
export const GET = POST;
