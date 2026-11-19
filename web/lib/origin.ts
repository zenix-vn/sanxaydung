import { SITE_URL } from '@/lib/ui';

// Origin công khai của request. Trong container Next standalone, `req.url` có dạng
// http://0.0.0.0:3000 (HOSTNAME/PORT nội bộ) nên KHÔNG dùng để dựng URL chuyển hướng.
// Lấy từ header Host (do reverse proxy chuyển tiếp), chỉ chấp nhận host hợp lệ;
// ngoài danh sách (hoặc không có) thì dùng SITE_URL.
const ALLOWED = [/^(www\.)?sanxaydung\.vn$/i, /^(localhost|127\.0\.0\.1)(:\d+)?$/i];

export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  if (!host || !ALLOWED.some((re) => re.test(host))) return SITE_URL;
  const local = /^(localhost|127\.0\.0\.1)/i.test(host);
  const proto = (h.get('x-forwarded-proto') ?? (local ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${host}`;
}
