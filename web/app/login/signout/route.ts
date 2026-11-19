import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  await createSupabaseServer().auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
// Cho phép link GET (nút "Đăng xuất" ở sidebar)
export const GET = POST;
