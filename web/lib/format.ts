// Nhãn & định dạng dùng chung cho các trang (an toàn cho cả client lẫn server).

export const TIER_COLORS: Record<string, string> = {
  gold: '#c08a1a',
  capability: '#0d6b3f',
  legal: '#12439c',
  none: '#555',
};

export const TIER_LABELS: Record<string, string> = {
  gold: 'Đối tác vàng',
  capability: 'Có chứng chỉ năng lực',
  legal: 'Đã xác minh pháp lý',
  none: 'Chưa xác minh',
};

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Chủ sở hữu',
  admin: 'Quản trị',
  editor: 'Biên tập',
  member: 'Thành viên',
};

export const LISTING_TYPE_LABEL: Record<string, string> = {
  need_contractor: 'Tìm nhà thầu',
  need_crew: 'Tìm đội thi công',
  need_supplier: 'Tìm nhà cung cấp',
  partnership: 'Hợp tác',
  offer_service: 'Cung cấp dịch vụ',
  opportunity: 'Cơ hội',
};

export const LISTING_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Đang mở', cls: 'green' },
  closed: { label: 'Đã đóng', cls: 'gray' },
  fulfilled: { label: 'Hoàn tất', cls: '' },
  expired: { label: 'Hết hạn', cls: 'gray' },
};

export const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Đã gửi', cls: 'gray' },
  shortlisted: { label: 'Rút gọn', cls: '' },
  accepted: { label: 'Được chọn', cls: 'green' },
  rejected: { label: 'Từ chối', cls: 'red' },
  withdrawn: { label: 'Đã rút', cls: 'gray' },
};

export const CONNECTION_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Chờ phản hồi', cls: 'orange' },
  accepted: { label: 'Đang hợp tác', cls: '' },
  completed: { label: 'Đã hoàn tất', cls: 'green' },
  cancelled: { label: 'Đã hủy', cls: 'gray' },
};

function short(n: number) {
  if (n >= 1_000_000_000) return `${+(n / 1e9).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${+(n / 1e6).toFixed(0)} triệu`;
  return n.toLocaleString('vi-VN');
}

/** Khoảng ngân sách/giá: "500 triệu – 2 tỷ", "Từ 1 tỷ"… null nếu không có. */
export function fmtRange(from: number | null | undefined, to: number | null | undefined, unit?: string | null): string | null {
  if (!from && !to) return null;
  let s = from && to ? `${short(from)} – ${short(to)}` : from ? `Từ ${short(from)}` : `Đến ${short(to!)}`;
  if (unit) s += ` / ${unit}`;
  return s;
}

/** Số ngày còn lại tới hạn; null nếu không có hạn hoặc đã qua. */
export function daysLeft(deadline: string | null | undefined): { days: number; label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return { days: 0, label: 'Hết hạn hôm nay', urgent: true };
  return { days: diff, label: `Còn ${diff} ngày`, urgent: diff <= 3 };
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');

export const POST_TYPES: Record<string, { label: string; cls: string; icon: string }> = {
  news:               { label: 'Tin tức',           cls: '',       icon: 'ic-layers' },
  new_project:        { label: 'Dự án mới',         cls: '',       icon: 'ic-building' },
  completed_project:  { label: 'Dự án hoàn thành',  cls: 'green',  icon: 'ic-check' },
  recruitment:        { label: 'Tuyển dụng',        cls: 'orange', icon: 'ic-people' },
  equipment:          { label: 'Thiết bị',           cls: '',       icon: 'ic-gear' },
  certificate:        { label: 'Chứng nhận',        cls: '',       icon: 'ic-award' },
  promotion:          { label: 'Khuyến mãi',        cls: 'orange', icon: 'ic-tag' },
  activity:           { label: 'Hoạt động',         cls: '',       icon: 'ic-trending' },
};
