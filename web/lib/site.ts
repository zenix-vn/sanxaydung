// Website doanh nghiệp: <tên-miền-con>.sanxaydung.vn — dùng chung middleware, server và client.
// site_settings do thành viên công ty ghi trực tiếp qua API nên LUÔN làm sạch ở đây.
import { slugifyVi } from '@/lib/slug';

/** Tên miền gốc của các website doanh nghiệp. */
export const SITE_ROOT_DOMAIN = (process.env.NEXT_PUBLIC_SITE_ROOT_DOMAIN ?? 'sanxaydung.vn').toLowerCase();

export const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Khớp is_reserved_subdomain() trong migration 20261130090000. */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'demo', 'mail', 'smtp', 'imap', 'pop', 'ftp', 'ns1', 'ns2', 'cdn', 'static',
  'assets', 'img', 'media', 'files', 'storage', 'auth', 'rest', 'realtime', 'studio', 'supabase', 'kong',
  'sites', 'site', 'web', 'blog', 'help', 'hotro', 'support', 'status', 'dev', 'staging', 'test', 'beta',
  'san', 'sanxaydung', 'dashboard', 'login', 'm', 'mobile', 'shop', 'docs', 'webmail', 'cpanel',
]);

export function isValidSubdomain(s: string): boolean {
  return SUBDOMAIN_RE.test(s) && !RESERVED_SUBDOMAINS.has(s);
}

/**
 * Tên miền con từ Host của request, hoặc null nếu là tên miền của sàn.
 * Nhận cả `<x>.localhost` để chạy thử trên máy.
 */
export function subdomainFromHost(host: string | null): string | null {
  if (!host) return null;
  const h = host.toLowerCase().replace(/:\d+$/, '');
  for (const root of [SITE_ROOT_DOMAIN, 'localhost']) {
    if (h.endsWith(`.${root}`)) {
      const sub = h.slice(0, -root.length - 1);
      return !sub.includes('.') && isValidSubdomain(sub) ? sub : null;
    }
  }
  return null;
}

// ---------- Cấu hình ----------
export const SITE_TEMPLATES = { 'vung-chac': 'Vững chắc' } as const;
export type SiteTemplate = keyof typeof SITE_TEMPLATES;

export interface SiteSettings {
  /** Mặc định bật cho mọi hồ sơ đã xuất bản */
  enabled: boolean;
  template: SiteTemplate;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function parseSiteSettings(raw: unknown): SiteSettings {
  const r = obj(raw);
  return {
    enabled: r.enabled !== false,
    template: typeof r.template === 'string' && r.template in SITE_TEMPLATES ? (r.template as SiteTemplate) : 'vung-chac',
  };
}

// ---------- Địa chỉ ----------
type SiteOwner = { slug: string; site_subdomain?: string | null };

/** Tên miền con đang dùng: tên tự chọn, hoặc slug nếu slug hợp lệ làm tên miền con. */
export function siteSubdomain(c: SiteOwner): string | null {
  if (c.site_subdomain && isValidSubdomain(c.site_subdomain)) return c.site_subdomain;
  return isValidSubdomain(c.slug) ? c.slug : null;
}

/** Địa chỉ đầy đủ của website, vd. https://minh-an.sanxaydung.vn */
export function siteUrl(c: SiteOwner): string | null {
  const sub = siteSubdomain(c);
  return sub ? `https://${sub}.${SITE_ROOT_DOMAIN}` : null;
}

/** Ghép đường dẫn trong website với tiền tố ('' trên tên miền con, '/site/<x>' khi xem qua sàn). */
export function siteHref(base: string, path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? (p === '/' ? base : `${base}${p}`) : p;
}

/** Đường dẫn trang chi tiết dự án: /du-an/<tiêu-đề>-<8 ký tự đầu id> */
export function projectPath(p: { id: string; title: string }): string {
  const s = slugifyVi(p.title).slice(0, 60).replace(/-+$/, '');
  return `/du-an/${s ? `${s}-` : ''}${p.id.slice(0, 8)}`;
}

/** 8 ký tự id ở cuối đường dẫn dự án, hoặc null. */
export function projectKey(segment: string): string | null {
  const m = segment.match(/(?:^|-)([0-9a-f]{8})$/i);
  return m ? m[1].toLowerCase() : null;
}
