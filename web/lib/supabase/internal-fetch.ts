import { SUPABASE_URL } from '@/lib/env';

// Phía server (container web) gọi Supabase qua mạng Docker nội bộ thay vì vòng ra domain công khai
// (TLS + OpenLiteSpeed + Kong). Client vẫn được khởi tạo với URL công khai nên tên cookie phiên không đổi.
//
// - SUPABASE_INTERNAL_URL (vd http://sxd-kong:8000): mọi đường dẫn đi qua Kong nội bộ.
// - SUPABASE_INTERNAL_REST_URL (vd http://sxd-rest:3000) / SUPABASE_INTERNAL_AUTH_URL (vd http://sxd-auth:9999):
//   /rest/v1 và /auth/v1 gọi THẲNG PostgREST / GoTrue, bỏ qua Kong (~50 ms mỗi request do plugin Lua).
//   An toàn vì supabase-js luôn gửi `Authorization: Bearer <JWT>` và hai dịch vụ tự kiểm JWT bằng cùng
//   JWT_SECRET; Kong chỉ thêm kiểm tra apikey. Chỉ dùng trong mạng Docker nội bộ.
// Không đặt biến nào → hành vi cũ (gọi URL công khai).
const strip = (v?: string) => (v ?? '').replace(/\/$/, '');
const INTERNAL = strip(process.env.SUPABASE_INTERNAL_URL);
const DIRECT: [string, string][] = [
  ['/rest/v1', strip(process.env.SUPABASE_INTERNAL_REST_URL)],
  ['/auth/v1', strip(process.env.SUPABASE_INTERNAL_AUTH_URL)],
];

/** URL công khai của Supabase → URL nội bộ tương ứng (null nếu không cần đổi). */
export function internalUrl(url: string): string | null {
  if (!SUPABASE_URL || !url.startsWith(SUPABASE_URL)) return null;
  const path = url.slice(SUPABASE_URL.length);
  for (const [prefix, base] of DIRECT) {
    if (base && (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))) {
      return base + path.slice(prefix.length);
    }
  }
  return INTERNAL ? INTERNAL + path : null;
}

export const serverFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  const next = internalUrl(url);
  if (!next) return fetch(input, init);
  return input instanceof Request ? fetch(new Request(next, input), init) : fetch(next, init);
};
