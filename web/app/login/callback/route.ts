import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/phone';

// Callback cho magic link / OAuth: đổi `code` lấy phiên, bảo đảm có profile, rồi chuyển về `redirect`.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeRedirect(url.searchParams.get('redirect'));
  const supa = createSupabaseServer();

  if (code) {
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/login?error=callback', url.origin));
  }

  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?error=callback', url.origin));

  // Trigger handle_new_user đã tạo profile; upsert phòng khi thiếu (bỏ qua lỗi).
  await supa.from('profiles').upsert(
    { id: user.id, phone: user.phone || null, full_name: (user.user_metadata?.full_name as string) ?? '' },
    { onConflict: 'id', ignoreDuplicates: true },
  );

  return NextResponse.redirect(new URL(next, url.origin));
}
