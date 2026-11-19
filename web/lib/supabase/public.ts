import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { serverFetch } from './internal-fetch';

// Client ẩn danh KHÔNG đọc cookie → dùng cho dữ liệu công khai, cho phép cache giữa các người dùng.
// Tuyệt đối không dùng cho dữ liệu riêng của người đăng nhập.
export function createSupabasePublic() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (i, init) => serverFetch(i, { ...init, cache: 'no-store' }) },
  });
}

/**
 * Cache kết quả hàm ở tầng dữ liệu (dùng chung mọi người dùng), tự làm mới sau `revalidate` giây.
 * `fn` phải NÉM LỖI khi truy vấn thất bại để lỗi không bị cache; nơi gọi tự bắt và trả dữ liệu rỗng.
 */
export function cachedPublic<A extends unknown[], R>(fn: (...a: A) => Promise<R>, key: string, revalidate = 60) {
  return unstable_cache(fn, ['pub', key], { revalidate });
}
