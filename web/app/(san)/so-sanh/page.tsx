import type { Metadata } from 'next';
import { createSupabasePublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import { TIER_LABELS } from '@/lib/format';
import { colorFor, initials, thumb } from '@/lib/ui';

export const metadata: Metadata = { title: 'So sánh doanh nghiệp', robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';

type Co = {
  id: string; name: string; slug: string; logo_url: string | null; verified_tier: string; trust_score: number | null;
  founded_year: number | null; size_range: string | null; address: string | null;
  company_categories: { categories: { name: string } | null }[];
  company_locations: { provinces: { name: string } | null }[];
  projects: { id: string }[]; services: { id: string }[]; equipment: { id: string }[];
  reviews: { overall: number | null; status: string }[];
};

async function load(slugs: string[]): Promise<Co[]> {
  if (!SUPABASE_URL || !slugs.length) return [];
  const { data } = await createSupabasePublic()
    .from('companies')
    .select(
      `id, name, slug, logo_url, verified_tier, trust_score, founded_year, size_range, address,
       company_categories ( categories ( name ) ), company_locations ( provinces ( name ) ),
       projects ( id ), services ( id ), equipment ( id ),
       reviews!target_company_id ( overall, status )`,
    )
    .in('slug', slugs)
    .eq('status', 'published')
    .is('deleted_at', null)
    .eq('reviews.status', 'published');
  const rows = (data ?? []) as unknown as Co[];
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as Co[];
}

export default async function ComparePage({ searchParams }: { searchParams: { c?: string | string[] } }) {
  const raw = Array.isArray(searchParams.c) ? searchParams.c : searchParams.c ? searchParams.c.split(',') : [];
  const slugs = Array.from(new Set(raw.map((s) => s.trim()).filter((s) => /^[a-z0-9-]{1,120}$/.test(s)))).slice(0, 3);
  const cos = await load(slugs);

  const rating = (c: Co) => {
    const v = c.reviews.map((r) => r.overall).filter((x): x is number => x != null);
    return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
  };
  const best = (vals: (number | null)[]) => Math.max(...vals.map((v) => v ?? -1));
  const rows: { label: string; get: (c: Co) => React.ReactNode; num?: (c: Co) => number | null }[] = [
    { label: 'Mức xác minh', get: (c) => TIER_LABELS[c.verified_tier] ?? '—' },
    { label: 'Trust Score', get: (c) => Math.round(c.trust_score ?? 0), num: (c) => Math.round(c.trust_score ?? 0) },
    { label: 'Đánh giá trung bình', get: (c) => (rating(c) != null ? `${rating(c)} ★ (${c.reviews.length})` : 'Chưa có'), num: rating },
    { label: 'Số dự án portfolio', get: (c) => c.projects.length, num: (c) => c.projects.length },
    { label: 'Dịch vụ', get: (c) => c.services.length, num: (c) => c.services.length },
    { label: 'Thiết bị', get: (c) => c.equipment.length, num: (c) => c.equipment.length },
    { label: 'Năm thành lập', get: (c) => c.founded_year ?? '—' },
    { label: 'Quy mô', get: (c) => c.size_range ?? '—' },
    { label: 'Lĩnh vực', get: (c) => c.company_categories.map((x) => x.categories?.name).filter(Boolean).join(', ') || '—' },
    { label: 'Khu vực hoạt động', get: (c) => c.company_locations.map((x) => x.provinces?.name).filter(Boolean).join(', ') || '—' },
  ];

  return (
    <>
      <div className="pagehead">
        <div className="container">
          <div className="crumb"><a href="/">Trang chủ</a><svg className="ic"><use href="#ic-chevron-right" /></svg><a href="/directory">Danh bạ</a><svg className="ic"><use href="#ic-chevron-right" /></svg><span>So sánh</span></div>
          <h1>So sánh doanh nghiệp</h1>
          <p>Đặt cạnh nhau năng lực, uy tín và kinh nghiệm để chọn đối tác phù hợp.</p>
        </div>
      </div>
      <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
        <div className="container">
          {cos.length < 2 ? (
            <div className="card-block" style={{ textAlign: 'center', padding: 40 }}>
              <p className="muted mb-16">Chọn 2–3 doanh nghiệp từ danh sách đã lưu để so sánh.</p>
              <a className="btn btn-orange" href="/dashboard/saved">Mở danh sách đã lưu</a>
            </div>
          ) : (
            <div className="card-block table-wrap">
              <table className="table cmp">
                <thead>
                  <tr>
                    <th style={{ width: 180 }} />
                    {cos.map((c) => (
                      <th key={c.id} style={{ textAlign: 'center', verticalAlign: 'top' }}>
                        {c.logo_url ? (
                          <img src={thumb(c.logo_url, 112)} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
                        ) : (
                          <span style={{ width: 56, height: 56, borderRadius: 12, background: colorFor(c.id), color: '#fff', fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{initials(c.name)}</span>
                        )}
                        <div style={{ marginTop: 8 }}><a href={`/cong-ty/${c.slug}`} style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 14 }}>{c.name}</a></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const top = r.num ? best(cos.map(r.num)) : null;
                    return (
                      <tr key={r.label}>
                        <td className="muted">{r.label}</td>
                        {cos.map((c) => {
                          const v = r.num?.(c);
                          const win = top != null && top > 0 && v === top && cos.filter((x) => r.num!(x) === top).length < cos.length;
                          return (
                            <td key={c.id} style={{ textAlign: 'center' }}>
                              {r.get(c)}
                              {win && <span className="badge green" style={{ marginLeft: 6 }}>Cao nhất</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  <tr>
                    <td />
                    {cos.map((c) => (
                      <td key={c.id} style={{ textAlign: 'center' }}>
                        <a className="btn btn-orange btn-sm" href={`/chat?to=${c.id}`}>Nhắn tin</a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
