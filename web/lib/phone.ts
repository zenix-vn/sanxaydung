/** Chuẩn hóa SĐT Việt Nam về dạng E.164 (+84…) để dùng với Supabase Auth. */
export function toE164VN(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, '');
  if (/^\+84\d{9}$/.test(d)) return d;
  if (/^84\d{9}$/.test(d)) return `+${d}`;
  if (/^0\d{9}$/.test(d)) return `+84${d.slice(1)}`;
  return null;
}

/** Dạng nội địa 0xxxxxxxxx — khóa chống trùng theo SĐT trong DB. */
export function toLocalVN(raw: string): string | null {
  const e = toE164VN(raw);
  return e ? `0${e.slice(3)}` : null;
}

/** Chỉ cho phép redirect nội bộ (chống open-redirect). */
export function safeRedirect(next: string | null | undefined, fallback = '/dashboard') {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
