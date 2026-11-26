/** Gói dịch vụ — nguồn dữ liệu duy nhất là bảng `plans` (sửa tại /admin/plans). */
export type Plan = {
  id: string;
  name: string;
  price_month: number;
  features: {
    desc?: string; bullets?: string[]; excluded?: string[]; contact?: boolean;
    listings?: number; members?: number; featured?: number; analytics?: boolean; api?: boolean;
  };
};

/** Trả theo năm được giảm 20%. */
export const yearlyPrice = (month: number) => Math.round(month * 12 * 0.8);
export const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}₫`;
/** 990000 → "990K", 1990000 → "1,99 triệu" */
export function shortVnd(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu`;
  return n >= 1000 ? `${Math.round(n / 1000).toLocaleString('vi-VN')}K` : `${n}₫`;
}
export const limitText = (v: number | undefined) => (v == null ? '—' : v < 0 ? 'Không giới hạn' : v.toLocaleString('vi-VN'));
