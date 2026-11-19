// Helper hiển thị dùng chung cho các trang cộng đồng & giao dịch.

export const BG_COLORS = ['#12439c', '#0d6b3f', '#c0392b', '#b5610f', '#7a5a0f', '#17479e', '#111', '#27ae60'];

export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BG_COLORS[h % BG_COLORS.length];
}

export function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter((w) => w.length > 1)
      .slice(-2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  );
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 172800) return 'Hôm qua';
  return `${Math.floor(diff / 86400)} ngày trước`;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '';
  if (n >= 1_000_000_000) return `${+(n / 1_000_000_000).toFixed(2)} tỷ`;
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)} triệu`;
  return n.toLocaleString('vi-VN');
}

/** "52.000.000.000" | "52 tỷ" | "500tr" → số (VND). Trả null nếu không hiểu. */
export function parseMoney(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^([\d.,]+)(tỷ|ty|tr|triệu|trieu|k)?$/);
  if (!m) return null;
  const unit = m[2];
  let raw = m[1];
  if (unit) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(/[.,]/g, '');
  const n = Number(raw);
  if (!isFinite(n)) return null;
  const mult = unit === 'tỷ' || unit === 'ty' ? 1e9 : unit === 'tr' || unit === 'triệu' || unit === 'trieu' ? 1e6 : unit === 'k' ? 1e3 : 1;
  return Math.round(n * mult);
}

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sanxaydung.vn').replace(/\/$/, '');

/** Ảnh logo từ Google (lh3) mặc định tải bản gốc rất lớn → yêu cầu bản vuông nhỏ. */
export function thumb(url: string | null | undefined, size = 160): string | undefined {
  if (!url) return undefined;
  return /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+$/.test(url) ? `${url}=s${size}` : url;
}
