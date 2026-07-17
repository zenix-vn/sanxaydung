import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

type CookieItem = { name: string; value: string; options: CookieOptions };

// Client cho Server Components / SSR: đọc phiên đăng nhập từ cookie.
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: CookieItem[]) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // gọi từ Server Component (không set được cookie) — bỏ qua, middleware sẽ làm mới
        }
      },
    },
  });
}
