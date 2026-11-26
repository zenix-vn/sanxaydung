// Tùy biến trang hồ sơ doanh nghiệp — dùng chung client lẫn server.
// profile_settings và media.url do thành viên công ty ghi trực tiếp qua API nên LUÔN
// phải làm sạch ở đây trước khi hiển thị.

export const LINK_KINDS = ['zalo', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_META: Record<LinkKind, { label: string; hosts: string[]; placeholder: string }> = {
  zalo: { label: 'Zalo', hosts: ['zalo.me'], placeholder: 'Số Zalo (vd. 0912 345 678) hoặc link zalo.me' },
  facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.com'], placeholder: 'facebook.com/tencongty' },
  youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], placeholder: 'youtube.com/@tencongty' },
  linkedin: { label: 'LinkedIn', hosts: ['linkedin.com'], placeholder: 'linkedin.com/company/tencongty' },
  tiktok: { label: 'TikTok', hosts: ['tiktok.com'], placeholder: 'tiktok.com/@tencongty' },
};

export const MAX_HIGHLIGHTS = 4;
export const MAX_TAGLINE = 90;
export const MAX_HL_VALUE = 14;
export const MAX_HL_LABEL = 40;

export type Highlight = { value: string; label: string };

// ---------- Các mục trên trang hồ sơ ----------
/** Thứ tự mặc định. Khóa cũng là id neo (#...) trên trang công khai. */
export const SECTION_KEYS = ['gioithieu', 'duan', 'thuvien', 'dichvu', 'doitac', 'danhgia', 'tailieu', 'giaithuong', 'nhansu', 'baidang', 'tindang'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABELS: Record<SectionKey, string> = {
  gioithieu: 'Giới thiệu',
  duan: 'Dự án',
  thuvien: 'Hình ảnh & video',
  dichvu: 'Dịch vụ',
  doitac: 'Khách hàng & đối tác',
  danhgia: 'Đánh giá',
  tailieu: 'Hồ sơ năng lực',
  giaithuong: 'Giải thưởng & chứng nhận',
  nhansu: 'Nhân sự & thiết bị',
  baidang: 'Bài đăng',
  tindang: 'Tin đang đăng',
};
/** Không cho ẩn: đánh giá của đối tác là căn cứ tin cậy của sàn. */
export const LOCKED_SECTIONS: readonly SectionKey[] = ['gioithieu', 'danhgia'];

export const MAX_VISION = 600;
export const MAX_VALUES = 8;
export const MAX_VALUE_LEN = 120;
export type About = { vision?: string; mission?: string; values?: string[] };
export interface ProfileSettings {
  brand_color?: string;
  tagline?: string;
  cover_focus?: { x: number; y: number };
  highlights?: Highlight[];
  links?: Partial<Record<LinkKind, string>>;
  about?: About;
  sections?: { order?: SectionKey[]; hidden?: SectionKey[] };
}

const HEX = /^#[0-9a-f]{6}$/i;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 50);

function toUrl(input: string): URL | null {
  const s = input.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}
const onHost = (u: URL, hosts: string[]) => hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));

/** URL http(s) hợp lệ, hoặc null (chặn javascript:, data:…). */
export function safeHttpUrl(input: unknown): string | null {
  return typeof input === 'string' && /^https?:\/\//i.test(input.trim()) ? toUrl(input)?.href ?? null : null;
}

/** Chuẩn hóa liên kết mạng xã hội người dùng nhập. null nếu không hợp lệ. */
export function normalizeLink(kind: LinkKind, input: string): string | null {
  if (kind === 'zalo') {
    const digits = input.replace(/[\s.\-()]/g, '');
    const m = digits.match(/^(?:\+?84|0)(\d{9})$/);
    if (m) return `https://zalo.me/0${m[1]}`;
  }
  const u = toUrl(input);
  if (!u || !onHost(u, LINK_META[kind].hosts) || u.pathname === '/') return null;
  u.protocol = 'https:';
  return u.href.slice(0, 300);
}

export function parseProfileSettings(raw: unknown): ProfileSettings {
  const r = obj(raw);
  const out: ProfileSettings = {};
  if (typeof r.brand_color === 'string' && HEX.test(r.brand_color)) out.brand_color = r.brand_color.toLowerCase();
  const tagline = str(r.tagline, MAX_TAGLINE);
  if (tagline) out.tagline = tagline;
  if (r.cover_focus && typeof r.cover_focus === 'object') {
    const f = obj(r.cover_focus);
    out.cover_focus = { x: pct(f.x), y: pct(f.y) };
  }
  if (Array.isArray(r.highlights)) {
    const hl = r.highlights
      .map((h) => ({ value: str(obj(h).value, MAX_HL_VALUE), label: str(obj(h).label, MAX_HL_LABEL) }))
      .filter((h) => h.value && h.label)
      .slice(0, MAX_HIGHLIGHTS);
    if (hl.length) out.highlights = hl;
  }
  const rl = obj(r.links);
  const links: Partial<Record<LinkKind, string>> = {};
  for (const k of LINK_KINDS) {
    const v = typeof rl[k] === 'string' ? normalizeLink(k, rl[k] as string) : null;
    if (v) links[k] = v;
  }
  if (Object.keys(links).length) out.links = links;

  const ra = obj(r.about);
  const about: About = {};
  const vision = str(ra.vision, MAX_VISION);
  const mission = str(ra.mission, MAX_VISION);
  const values = Array.isArray(ra.values) ? ra.values.map((v) => str(v, MAX_VALUE_LEN)).filter(Boolean).slice(0, MAX_VALUES) : [];
  if (vision) about.vision = vision;
  if (mission) about.mission = mission;
  if (values.length) about.values = values;
  if (Object.keys(about).length) out.about = about;

  const rs = obj(r.sections);
  const order = sectionOrder(rs.order);
  const hidden = sectionKeys(rs.hidden).filter((k) => !LOCKED_SECTIONS.includes(k));
  const custom = order.some((k, i) => k !== SECTION_KEYS[i]);
  if (custom || hidden.length) out.sections = { ...(custom ? { order } : {}), ...(hidden.length ? { hidden } : {}) };
  return out;
}

const sectionKeys = (v: unknown): SectionKey[] =>
  Array.isArray(v) ? Array.from(new Set(v.filter((k): k is SectionKey => (SECTION_KEYS as readonly unknown[]).includes(k)))) : [];

/** Thứ tự đã lưu, bổ sung các mục còn thiếu (mục mới thêm sau này) vào cuối. */
export function sectionOrder(saved: unknown): SectionKey[] {
  const first = sectionKeys(saved);
  return [...first, ...SECTION_KEYS.filter((k) => !first.includes(k))];
}

// ---------- Màu thương hiệu ----------
export const BRAND_PRESETS = ['#c2620a', '#c0392b', '#a4133c', '#6d28d9', '#12439c', '#0369a1', '#0f766e', '#0d6b3f', '#7a5a0f', '#374151'];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
function contrastOnWhite(c: number[]) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

/** Làm đậm màu quá sáng để chữ trắng trên nút vẫn đọc được. */
export function readableBrand(hex: string): string {
  let c = rgb(hex);
  for (let i = 0; i < 30 && contrastOnWhite(c) < 3.5; i++) c = c.map((v) => v * 0.93);
  return toHex(c);
}

/** Ghi đè biến CSS --orange* trong phạm vi trang hồ sơ. */
export function brandVars(hex: string): Record<string, string> {
  const main = readableBrand(hex);
  const c = rgb(main);
  const white = [255, 255, 255];
  return {
    '--orange': main,
    '--orange-2': toHex(mix(c, white, 0.16)),
    '--orange-soft': toHex(mix(c, white, 0.92)),
    '--brand-line': toHex(mix(c, white, 0.75)),
  };
}

// ---------- Ảnh bìa ----------
export function coverPosition(s: ProfileSettings): string {
  return s.cover_focus ? `${s.cover_focus.x}% ${s.cover_focus.y}%` : 'center';
}
export const cssUrl = (u: string) => `url("${u.replace(/["\\\n\r]/g, (ch) => encodeURIComponent(ch))}")`;

// ---------- Video (chỉ nhận YouTube / Facebook) ----------
export type Video = { provider: 'youtube' | 'facebook'; url: string; embed: string; thumb: string | null };

export function parseVideo(input: unknown): Video | null {
  if (typeof input !== 'string') return null;
  const u = toUrl(input);
  if (!u) return null;
  if (onHost(u, ['youtube.com', 'youtu.be', 'youtube-nocookie.com'])) {
    const parts = u.pathname.split('/').filter(Boolean);
    const id = u.hostname.endsWith('youtu.be')
      ? parts[0]
      : u.searchParams.get('v') ?? (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : null);
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return {
      provider: 'youtube',
      url: `https://www.youtube.com/watch?v=${id}`,
      embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }
  const isFbVideo =
    (onHost(u, ['facebook.com']) && (/\/(videos|reel)\/|\/share\/[vr]\//.test(u.pathname) || (/^\/watch\/?$/.test(u.pathname) && u.searchParams.has('v')))) ||
    (u.hostname === 'fb.watch' && u.pathname !== '/');
  if (!isFbVideo) return null;
  u.protocol = 'https:';
  return {
    provider: 'facebook',
    url: u.href,
    embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false&autoplay=true`,
    thumb: null,
  };
}

// ---------- Thư viện ----------
export const MAX_GALLERY = 60;
export type GalleryItem = { id: string; kind: 'image' | 'video'; url: string; caption: string | null; sort_order?: number | null };

// ---------- Dự án ----------
export const PROJECT_KINDS: Record<string, string> = {
  residential: 'Nhà ở',
  industrial: 'Công nghiệp',
  commercial: 'Thương mại & văn phòng',
  public: 'Công trình công cộng',
  infrastructure: 'Hạ tầng',
  interior: 'Nội thất',
  other: 'Khác',
};
export const MAX_FEATURED = 3;

// ---------- Khách hàng, đối tác, giải thưởng ----------
export const PARTNER_KINDS: Record<string, string> = { client: 'Khách hàng', partner: 'Đối tác' };
export const AWARD_KINDS: Record<string, string> = { certificate: 'Chứng nhận', award: 'Giải thưởng' };
export const MAX_PARTNERS = 40;
export const MAX_AWARDS = 30;

export type Partner = {
  id: string; kind: 'client' | 'partner'; name: string; logo_url: string | null; website: string | null;
  linked_company_id: string | null; sort_order?: number;
  linked?: { slug: string; name: string; logo_url: string | null; status: string } | null;
};
export type Award = { id: string; kind: 'certificate' | 'award'; title: string; issuer: string | null; year: number | null; image_url: string | null; sort_order?: number };

/** "example.com" → "https://example.com/"; null nếu không phải địa chỉ web. */
export function normalizeWebsite(input: string): string | null {
  const u = toUrl(input);
  return u && u.hostname.includes('.') ? u.href.slice(0, 300) : null;
}
