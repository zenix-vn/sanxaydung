import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { publicOrigin } from '@/lib/origin';

export async function POST(req: Request) {
  await createSupabaseServer().auth.signOut();
  return NextResponse.redirect(new URL('/login', publicOrigin(req)), { status: 303 });
}
// Cho phép link GET (nút "Đăng xuất" ở sidebar)
export const GET = POST;
