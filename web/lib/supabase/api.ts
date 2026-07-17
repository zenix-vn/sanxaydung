import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, assertSupabaseEnv } from '@/lib/env';

/**
 * Supabase client cho Route Handlers (API dùng chung web + mobile).
 * - Mobile / client ngoài: gửi `Authorization: Bearer <access_token>` -> RLS áp theo user.
 * - Không có token: dùng anon (chỉ đọc dữ liệu công khai theo RLS).
 */
export function supabaseFromRequest(req: Request) {
  assertSupabaseEnv();
  const authorization = req.headers.get('authorization') ?? '';
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
      // Tắt cache fetch của Next để API luôn trả dữ liệu mới nhất (web + mobile)
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
