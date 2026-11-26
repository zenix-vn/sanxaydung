import type { Metadata } from 'next';
import { getPairs, landingPath, type Pair } from '@/lib/landing';

export const metadata: Metadata = {
  title: 'Doanh nghiệp xây dựng theo lĩnh vực & tỉnh thành',
  description: 'Tra cứu nhà thầu, đội thi công, nhà cung cấp theo từng lĩnh vực và tỉnh thành trên Sàn Xây Dựng.',
  alternates: { canonical: '/linh-vuc' },
};
export const dynamic = 'force-dynamic';

export default async function LandingIndex() {
  const pairs = await getPairs();
  const byCat = new Map<string, Pair[]>();
  for (const p of pairs) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  return (
    <>
      <div className="pagehead">
        <div className="container">
          <div className="crumb"><a href="/">Trang chủ</a><svg className="ic"><use href="#ic-chevron-right" /></svg><span>Lĩnh vực &amp; tỉnh thành</span></div>
          <h1>Doanh nghiệp theo lĩnh vực &amp; tỉnh thành</h1>
        </div>
      </div>
      <section className="block" style={{ background: 'var(--bg)', paddingTop: 26 }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {pairs.length === 0 && <p className="muted">Chưa có dữ liệu.</p>}
          {Array.from(byCat.values()).map((list) => (
            <div key={list[0].category} className="card-block">
              <h2 style={{ fontSize: 16 }}>{list[0].category_name}</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {list.slice(0, 15).map((p) => (
                  <li key={p.province} style={{ padding: '5px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <a href={landingPath(p)}>{p.province_name}</a><small className="muted">{p.total}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
