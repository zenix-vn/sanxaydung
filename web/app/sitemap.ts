import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { SITE_URL } from '@/lib/ui';

// Sitemap động: trang tĩnh + doanh nghiệp đã công khai + tin đăng đang mở. Làm mới mỗi giờ.
export const revalidate = 3600;

const STATIC: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/directory', priority: 0.9, changeFrequency: 'daily' },
  { path: '/marketplace', priority: 0.9, changeFrequency: 'hourly' },
  { path: '/feed', priority: 0.7, changeFrequency: 'hourly' },
  { path: '/pricing', priority: 0.5, changeFrequency: 'monthly' },
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
