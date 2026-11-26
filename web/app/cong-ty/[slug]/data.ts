// Dữ liệu trang hồ sơ. Khách: client ẩn danh + cache 30 giây. Thành viên của doanh nghiệp:
// client theo phiên, không cache — thấy ngay thay đổi vừa lưu và xem được hồ sơ chưa xuất bản.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import type { CompanyDetail } from '@/lib/types';
import {
  MAX_AWARDS, MAX_BRANCHES, MAX_FAQS, MAX_GALLERY, MAX_MILESTONES, MAX_PARTNERS, parseVideo, safeHttpUrl,
  type Award, type Branch, type Faq, type GalleryItem, type Milestone, type Partner,
} from '@/lib/profile';
import type { CoListing, CoPost } from './ShowcaseSections';

export type SharedDoc = { id: string; title: string; file_url: string; visibility: 'public' | 'connections'; size_bytes: number | null };
export type Extras = {
  partners: Partner[]; awards: Award[]; milestones: Milestone[]; branches: Branch[]; faqs: Faq[]; posts: CoPost[]; listings: CoListing[];
};
const NO_EXTRAS: Extras = { partners: [], awards: [], milestones: [], branches: [], faqs: [], posts: [], listings: [] };

async function queryCompany(db: SupabaseClient, slug: string, publishedOnly: boolean): Promise<CompanyDetail | null> {
  let q = db
    .from('companies')
    .select(
      `*,
       company_categories ( categories (*) ),
       company_locations ( provinces (*) ),
       projects ( * ),
       trust_scores ( score, breakdown ),
       company_verifications ( id, kind, cert_class, status, verified_at ),
       services ( * ),
       staff ( * ),
       equipment ( * ),
       reviews!target_company_id (
         id, connection_id, reviewer_company_id, target_company_id,
         score_quality, score_progress, score_cost, score_cooperation,
         score_safety, score_warranty, overall, comment, status, created_at, reply,
         reviewer_company:companies!reviewer_company_id ( id, name, slug, logo_url )
       )`,
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .eq('reviews.status', 'published')
    .eq('company_verifications.status', 'verified')
    .order('created_at', { referencedTable: 'reviews', ascending: false });
  if (publishedOnly) q = q.eq('status', 'published');
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data as unknown as CompanyDetail) ?? null;
}

async function queryProjectPhotos(db: SupabaseClient, companyId: string) {
  const { data, error } = await db
    .from('media')
    .select('owner_id, url')
    .eq('company_id', companyId)
    .eq('owner_type', 'project')
    .eq('kind', 'image')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as { owner_id: string; url: string }[];
}

async function queryGallery(db: SupabaseClient, companyId: string) {
  const { data, error } = await db
    .from('media')
    .select('id, kind, url, caption')
    .eq('company_id', companyId)
    .eq('owner_type', 'company')
    .is('hidden_at', null) // mục bị sàn ẩn không hiện, kể cả với thành viên
    .order('sort_order')
    .order('created_at')
    .limit(MAX_GALLERY);
  if (error) throw error;
  return (data ?? []) as GalleryItem[];
}

async function queryExtras(db: SupabaseClient, companyId: string): Promise<Extras> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const list = (table: string, select: string, max: number) =>
    db.from(table).select(select).eq('company_id', companyId).order('sort_order').order('created_at').limit(max);
  const results = await Promise.all([
    list('company_partners', '*, linked:companies!linked_company_id ( slug, name, logo_url, status )', MAX_PARTNERS),
    list('company_awards', '*', MAX_AWARDS),
    list('company_milestones', '*', MAX_MILESTONES),
    list('company_branches', '*', MAX_BRANCHES),
    list('company_faqs', '*', MAX_FAQS),
    db.from('posts').select('id, type, title, body, like_count, comment_count, created_at')
      .eq('company_id', companyId).eq('status', 'published').is('deleted_at', null).order('created_at', { ascending: false }).limit(30),
    db.from('marketplace_listings').select('id, type, title, budget_from, budget_to, deadline, created_at')
      .eq('company_id', companyId).eq('status', 'open').is('deleted_at', null).or(`deadline.is.null,deadline.gte.${today}`)
      .order('created_at', { ascending: false }).limit(10),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
  const [partners, awards, milestones, branches, faqs, posts, listings] = results.map((r) => r.data ?? []) as unknown[];
  return { partners, awards, milestones, branches, faqs, posts, listings } as Extras;
}

// Hàm cache ném lỗi khi truy vấn hỏng để lỗi không bị lưu lại
const cachedCompany = cachedPublic((slug: string) => queryCompany(createSupabasePublic(), slug, true), 'company', 30);
const cachedPhotos = cachedPublic((id: string) => queryProjectPhotos(createSupabasePublic(), id), 'project-photos', 60);
const cachedGallery = cachedPublic((id: string) => queryGallery(createSupabasePublic(), id), 'company-gallery', 30);
const cachedExtras = cachedPublic((id: string) => queryExtras(createSupabasePublic(), id), 'company-extras', 30);

export async function getCompany(slug: string, asMember: boolean): Promise<CompanyDetail | null> {
  if (!SUPABASE_URL) return null;
  try {
    return await (asMember ? queryCompany(createSupabaseServer(), slug, false) : cachedCompany(slug));
  } catch {
    return null;
  }
}

/** Các mục phụ: lỗi truy vấn chỉ làm mục đó trống, không làm hỏng cả trang. */
export async function getContent(companyId: string, asMember: boolean) {
  const run = <T,>(fresh: () => Promise<T>, cached: () => Promise<T>, empty: T) => (asMember ? fresh() : cached()).catch(() => empty);
  const db = () => createSupabaseServer();
  const [rows, gallery, extras] = await Promise.all([
    run(() => queryProjectPhotos(db(), companyId), () => cachedPhotos(companyId), []),
    run(() => queryGallery(db(), companyId), () => cachedGallery(companyId), []),
    run(() => queryExtras(db(), companyId), () => cachedExtras(companyId), NO_EXTRAS),
  ]);
  return {
    photos: rows.reduce((m, r) => m.set(r.owner_id, [...(m.get(r.owner_id) ?? []), r.url]), new Map<string, string[]>()),
    // Bỏ link không hợp lệ (media.url do thành viên ghi trực tiếp được)
    gallery: gallery.filter((m) => (m.kind === 'video' ? parseVideo(m.url) : safeHttpUrl(m.url))),
    extras,
  };
}

/** Tài liệu chia sẻ ra ngoài mà người đang xem được phép thấy (RLS lọc theo phiên) — không cache. */
export async function getSharedDocs(companyId: string, publicOnly: boolean): Promise<SharedDoc[]> {
  if (!SUPABASE_URL) return [];
  try {
    const { data } = await createSupabaseServer()
      .from('documents')
      .select('id, title, file_url, visibility, size_bytes')
      .eq('company_id', companyId)
      .in('visibility', publicOnly ? ['public'] : ['public', 'connections'])
      .order('created_at', { ascending: false });
    return (data ?? []) as SharedDoc[];
  } catch {
    return [];
  }
}
