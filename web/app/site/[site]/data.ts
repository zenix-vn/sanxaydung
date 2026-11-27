// Dữ liệu website doanh nghiệp. Chỉ hiện hồ sơ ĐÃ XUẤT BẢN, qua client ẩn danh có cache —
// website là trang công khai, không phụ thuộc phiên đăng nhập.
import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SUPABASE_URL } from '@/lib/env';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { getCompany, getContent, getSharedDocs } from '@/app/(san)/cong-ty/[slug]/data';
import { parseProfileSettings, MAX_FEATURED, type ProfileSettings } from '@/lib/profile';
import { parseSiteSettings, siteHref, siteUrl, isValidSubdomain, projectPath, type SiteSettings } from '@/lib/site';
import type { CompanyDetail, Project } from '@/lib/types';

/** Tên miền con tự chọn → slug. null nếu không có (hoặc DB chưa có cột site_subdomain). */
const slugBySubdomain = cachedPublic(
  async (sub: string): Promise<string | null> => {
    const { data, error } = await createSupabasePublic()
      .from('companies')
      .select('slug')
      .eq('site_subdomain', sub)
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle();
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') return null; // chưa áp migration
      throw error;
    }
    return (data?.slug as string | undefined) ?? null;
  },
  'site-subdomain',
  60,
);

export type SiteCompany = CompanyDetail & { site_subdomain?: string | null; site_settings?: unknown };

export type Site = {
  c: SiteCompany;
  settings: ProfileSettings;
  site: SiteSettings;
  /** Tiền tố đường dẫn: '' trên tên miền con, '/site/<x>' khi xem qua tên miền của sàn */
  base: string;
  href: (path?: string) => string;
};

/** Tải doanh nghiệp của website; 404 nếu không có, chưa xuất bản hoặc đã tắt website. Gộp lời gọi trong một request. */
export const getSite = cache(async (key: string): Promise<Site> => {
  if (!SUPABASE_URL || !/^[a-z0-9-]{1,80}$/.test(key)) notFound();
  let slug: string | null = null;
  try {
    slug = isValidSubdomain(key) ? await slugBySubdomain(key) : null;
  } catch {
    slug = null;
  }
  const c = (await getCompany(slug ?? key, false)) as SiteCompany | null;
  if (!c || c.status !== 'published') notFound();
  const site = parseSiteSettings(c.site_settings);
  if (!site.enabled) notFound();
  const hostMode = headers().get('x-site-host') === key;
  // Đã chọn tên miền con riêng: địa chỉ theo slug cũ chuyển sang địa chỉ mới (link đã chia sẻ không bị hỏng)
  if (!slug && c.site_subdomain && isValidSubdomain(c.site_subdomain) && c.site_subdomain !== key) {
    redirect(hostMode ? siteUrl(c)! : `/site/${c.site_subdomain}`);
  }
  const base = hostMode ? '' : `/site/${key}`;
  return { c, settings: parseProfileSettings(c.profile_settings), site, base, href: (p = '/') => siteHref(base, p) };
});

export const getSiteContent = cache((companyId: string) => getContent(companyId, false));
export const getSiteDocs = cache((companyId: string) => getSharedDocs(companyId, true));

export type ProjectCard = Project & { featured: boolean; photos: string[]; path: string };

/** Dự án ghim đứng đầu, còn lại theo năm mới nhất. */
export function projectCards(c: CompanyDetail, photos: Map<string, string[]>): ProjectCard[] {
  const featured = new Set((c.projects ?? []).filter((p) => p.is_featured).slice(0, MAX_FEATURED).map((p) => p.id));
  return [...(c.projects ?? [])]
    .sort((a, b) => Number(featured.has(b.id)) - Number(featured.has(a.id)) || (b.year ?? 0) - (a.year ?? 0))
    .map((p) => ({ ...p, featured: featured.has(p.id), photos: photos.get(p.id) ?? [], path: projectPath(p) }));
}

/** Số điện thoại dạng gọi được. */
export const telOf = (phone: string | null) => (phone ? phone.replace(/[^\d+]/g, '') : null);
