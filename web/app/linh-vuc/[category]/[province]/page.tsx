import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { getPairs, landingPath, type Pair } from '@/lib/landing';
import { slugifyVi } from '@/lib/slug';
import { SITE_URL, colorFor, initials, thumb } from '@/lib/ui';
import { TIER_LABELS } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Item = { id: string; slug: string; name: string; logo_url: string | null; intro: string | null; verified_tier: string; trust_score: number | null; rating: number | null; review_count: number; categories: string[] };

const fetchItems = cachedPublic(async (categoryId: string, province: string) => {
  const { data, error } = await createSupabasePublic().rpc('directory_search', {
    q: null, _category: categoryId, _province: province, _verified_only: false, _group: null, _sort: 'trust', _limit: 30, _offset: 0,
  });
  if (error) throw error;
  return data as { total: number; items: Item[] };
}, 'landing-items', 600);

const fetchCategory = cachedPublic(async (slug: string) => {
  const { data, error } = await createSupabasePublic().from('categories').select('id, name, slug, parent_id').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as { id: string; name: string; slug: string; parent_id: string | null } | null;
}, 'landing-cat', 3600);

async function resolve(params: { category: string; province: string }) {
  const pairs = await getPairs();
  const pair = pairs.find((p) => p.category === params.category && slugifyVi(p.province_name) === params.province);
  if (!pair) return null;
  const cat = await fetchCategory(pair.category).catch(() => null);
  if (!cat) return null;
  return { pair, cat, pairs };
}

export async function generateMetadata({ params }: { params: { category: string; province: string } }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return { title: 'Không tìm thấy', robots: { index: false } };
  const { pair } = r;
  const title = `${pair.category_name} tại ${pair.province_name} — ${pair.total} doanh nghiệp uy tín`;
  const description = `Danh sách ${pair.total} ${pair.category_name.toLowerCase()} hoạt động tại ${pair.province_name}: hồ sơ năng lực, dự án, đánh giá xác thực và Trust Score. So sánh và nhận báo giá miễn phí.`;
  const url = `${SITE_URL}${landingPath(pair)}`;
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, url, type: 'website' } };
}

export default async function LandingPage({ params }: { params: { category: string; province: string } }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { pair, cat, pairs } = r;
  const res = await fetchItems(cat.id, pair.province).catch(() => ({ total: 0, items: [] as Item[] }));
  const otherProvinces = pairs.filter((p) => p.category === pair.category && p.province !== pair.province).slice(0, 12);
  const otherCats = pairs.filter((p) => p.province === pair.province && p.category !== pair.category).slice(0, 12);
  const url = `${SITE_URL}${landingPath(pair)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: pair.category_name, item: `${SITE_URL}/directory?category=${pair.category}` },
          { '@type': 'ListItem', position: 3, name: pair.province_name, item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${pair.category_name} tại ${pair.province_name}`,
        numberOfItems: res.total,
        itemListElement: res.items.slice(0, 20).map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/cong-ty/${c.slug}`, name: c.name })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="pagehead">
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a><svg className="ic"><use href="#ic-chevron-right" /></svg>
            <a href={`/directory?category=${pair.category}`}>{pair.category_name}</a><svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span>{pair.province_name}</span>
          </div>
          <h1>{pair.category_name} tại {pair.province_name}</h1>
          <p>{res.total} doanh nghiệp đang hoạt động, xếp theo Trust Score. Hồ sơ có xác minh pháp lý được đánh dấu.</p>
        </div>
      </div>
      <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
        <div className="container grid-side-r" style={{ gap: 20 }}>
          <div>
            {res.items.map((c) => (
              <a key={c.id} className="card-block crud-row" href={`/cong-ty/${c.slug}`} style={{ marginBottom: 12, textDecoration: 'none', color: 'inherit' }}>
                {c.logo_url ? (
                  <img src={thumb(c.logo_url, 112)} alt="" width={56} height={56} loading="lazy" style={{ borderRadius: 12, objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 56, height: 56, borderRadius: 12, background: colorFor(c.id), color: '#fff', fontWeight: 800, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(c.name)}</span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>{c.name}</h2>
                  <small className="muted">
                    {[c.verified_tier !== 'none' && TIER_LABELS[c.verified_tier], `Trust ${Math.round(c.trust_score ?? 0)}`, c.rating != null && `${c.rating}★ (${c.review_count})`, c.categories.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                  </small>
                  {c.intro && <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{c.intro.slice(0, 160)}</p>}
                </span>
              </a>
            ))}
            {res.total > res.items.length && (
              <a className="btn btn-outline" href={`/directory?category=${pair.category}&province=${pair.province}`}>Xem tất cả {res.total} doanh nghiệp →</a>
            )}
            <div className="card-block mt-24">
              <h2 style={{ fontSize: 17 }}>Cần {pair.category_name.toLowerCase()} tại {pair.province_name}?</h2>
              <p className="muted mb-16">Đăng nhu cầu miễn phí — các doanh nghiệp phù hợp sẽ gửi báo giá để bạn so sánh.</p>
              <a className="btn btn-orange" href="/marketplace/new">Đăng nhu cầu nhận báo giá</a>
            </div>
          </div>
          <aside>
            {otherProvinces.length > 0 && <Links title={`${pair.category_name} ở tỉnh khác`} items={otherProvinces} label={(p) => p.province_name} />}
            {otherCats.length > 0 && <Links title={`Lĩnh vực khác tại ${pair.province_name}`} items={otherCats} label={(p) => p.category_name} />}
          </aside>
        </div>
      </section>
    </>
  );
}

function Links({ title, items, label }: { title: string; items: Pair[]; label: (p: Pair) => string }) {
  return (
    <div className="card-block mb-24">
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((p) => (
          <li key={`${p.category}-${p.province}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--line-2)', display: 'flex', justifyContent: 'space-between' }}>
            <a href={landingPath(p)}>{label(p)}</a>
            <small className="muted">{p.total}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
