import { SUPABASE_URL } from '@/lib/env';

// Phía server (container web) gọi Supabase qua mạng Docker nội bộ (vd http://sxd-kong:8000)
// thay vì vòng ra domain công khai (TLS + OpenLiteSpeed + Kong). Client vẫn được khởi tạo với URL
// công khai nên tên cookie phiên không đổi. Không đặt SUPABASE_INTERNAL_URL → hành vi cũ.
const INTERNAL = (process.env.SUPABASE_INTERNAL_URL ?? '').replace(/\/$/, '');

export const serverFetch: typeof fetch = (input, init) => {
  if (!INTERNAL || !SUPABASE_URL) return fetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (!url.startsWith(SUPABASE_URL)) return fetch(input, init);
  const next = INTERNAL + url.slice(SUPABASE_URL.length);
  return input instanceof Request ? fetch(new Request(next, input), init) : fetch(next, init);
};
