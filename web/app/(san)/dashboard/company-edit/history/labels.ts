export type Revision = {
  id: number; entity: string; entity_id: string; action: 'insert' | 'update' | 'delete'; label: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; created_at: string;
  profiles: { full_name: string | null } | null;
};

export const ACTIONS = { insert: 'Thêm', update: 'Sửa', delete: 'Xóa' } as const;
export const ENTITIES: Record<string, string> = {
  companies: 'hồ sơ doanh nghiệp', projects: 'dự án', services: 'dịch vụ', staff: 'nhân sự', equipment: 'thiết bị',
  documents: 'tài liệu', media: 'ảnh/video', company_partners: 'khách hàng/đối tác', company_awards: 'giải thưởng',
  company_branches: 'chi nhánh', company_milestones: 'mốc phát triển', company_faqs: 'câu hỏi thường gặp',
};

/** Mục không gắn file bị xóa kèm → khôi phục an toàn. */
const RESTORE_DELETED = ['projects', 'services', 'equipment', 'company_faqs', 'company_branches'];
export const canRestore = (r: Revision) =>
  !!r.before && ((r.action === 'update' && (r.entity === 'companies' || RESTORE_DELETED.includes(r.entity))) || (r.action === 'delete' && RESTORE_DELETED.includes(r.entity)));

const FIELDS: Record<string, string> = {
  name: 'Tên', slug: 'Đường dẫn', legal_name: 'Tên pháp lý', tax_code: 'Mã số thuế', intro: 'Mô tả ngắn', description: 'Mô tả',
  website: 'Website', email: 'Email', phone: 'Điện thoại', address: 'Địa chỉ', province_code: 'Mã tỉnh/thành', founded_year: 'Năm thành lập',
  size_range: 'Quy mô', logo_url: 'Logo', cover_url: 'Ảnh bìa', status: 'Trạng thái', title: 'Tiêu đề', role: 'Vai trò', year: 'Năm',
  kind: 'Loại', is_featured: 'Ghim nổi bật', price_from: 'Giá từ', price_to: 'Giá đến', price_unit: 'Đơn vị', full_name: 'Họ tên',
  experience_years: 'Số năm kinh nghiệm', certificate: 'Chứng chỉ', bio: 'Giới thiệu', quantity: 'Số lượng', note: 'Ghi chú',
  visibility: 'Mức riêng tư', caption: 'Chú thích', url: 'Đường dẫn file', file_url: 'File', question: 'Câu hỏi', answer: 'Trả lời',
  issuer: 'Đơn vị cấp', image_url: 'Ảnh', avatar_url: 'Ảnh chân dung', lat: 'Vĩ độ', lng: 'Kinh độ', hidden_at: 'Bị sàn ẩn',
  // trong profile_settings
  brand_color: 'Màu thương hiệu', tagline: 'Khẩu hiệu', cover_focus: 'Điểm lấy nét ảnh bìa', highlights: 'Số liệu nổi bật',
  links: 'Zalo & mạng xã hội', about: 'Tầm nhìn, sứ mệnh, giá trị', sections: 'Bố cục trang', cta: 'Nút liên hệ chính',
  hours: 'Giờ làm việc', response: 'Thời gian phản hồi', banner: 'Ảnh/video bìa phụ',
};
const STATUS: Record<string, string> = { draft: 'Bản nháp', published: 'Đã xuất bản', suspended: 'Bị tạm khóa' };
const HIDE_VALUE = new Set(['logo_url', 'cover_url', 'image_url', 'avatar_url', 'url', 'file_url', 'cover_focus', 'highlights', 'links', 'about', 'sections', 'banner']);

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (HIDE_VALUE.has(key)) return key.endsWith('url') ? '(file)' : '(cấu hình)';
  if (key === 'status') return STATUS[String(v)] ?? String(v);
  if (typeof v === 'boolean') return v ? 'Có' : 'Không';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

export type Change = { field: string; from: string | null; to: string };

export function describeChanges(r: Revision): Change[] {
  if (r.action !== 'update') return [];
  const out: Change[] = [];
  const push = (key: string, a: unknown, b: unknown) => {
    const from = show(key, a), to = show(key, b);
    // giá trị không in được (ảnh, cấu hình) chỉ nói là đã đổi
    out.push(HIDE_VALUE.has(key) ? { field: FIELDS[key] ?? key, from: null, to: b == null ? 'Đã gỡ' : a == null ? 'Đã thêm' : 'Đã thay đổi' } : { field: FIELDS[key] ?? key, from, to });
  };
  for (const key of Object.keys(r.after ?? {})) {
    const a = r.before?.[key], b = r.after![key];
    if (key === 'profile_settings') {
      const x = (a ?? {}) as Record<string, unknown>, y = (b ?? {}) as Record<string, unknown>;
      for (const k of Array.from(new Set([...Object.keys(x), ...Object.keys(y)]))) {
        if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) push(k, x[k], y[k]);
      }
    } else push(key, a, b);
  }
  return out;
}
