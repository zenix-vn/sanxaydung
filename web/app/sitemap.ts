import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { SITE_URL } from '@/lib/ui';

// Sitemap động: trang tĩnh + doanh nghiệp đã công khai + tin đăng đang mở.
// force-dynamic: nếu prerender lúc build thì container build không gọi được API → sitemap thiếu dữ liệu.
export const dynamic = 'force-dynamic';

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/directory', priority: 0.9, changeFrequency: 'daily' },
  { path: '/marketplace', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/feed', priority: 0.7, changeFrequency: 'hourly' },
  { path: '/pricing', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/huong-dan', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/cau-hoi-thuong-gap', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/trust-score', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/lien-he', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/dieu-khoan', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/chinh-sach-bao-mat', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${SITE_URL}${s.path}`,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return out;

  try {
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await supa.rpc('sitemap_entries');
    (data ?? []).forEach((e: { kind: string; path: string; updated_at: string | null }) =>
      out.push({
        url: `${SITE_URL}${e.path}`,
        lastModified: e.updated_at ?? undefined,
        changeFrequency: e.kind === 'company' ? 'weekly' : 'daily',
        priority: e.kind === 'company' ? 0.8 : 0.6,
      }),
    );
  } catch {
    /* trả về phần tĩnh nếu DB không truy cập được */
  }
  return out;
}
