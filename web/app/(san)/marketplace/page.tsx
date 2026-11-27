import type { Metadata } from 'next';
import AdSlot from '@/components/AdSlot';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import Pagination from '@/components/Pagination';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import { LISTING_TYPE_LABEL as TYPE_LABEL, fmtRange, daysLeft, fmtDate } from '@/lib/format';
import { colorFor, initials, thumb } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nhu cầu & Báo giá',
  description: 'Đăng nhu cầu, nhận nhiều báo giá và chọn đối tác xây dựng uy tín: tìm nhà thầu, đội thi công, nhà cung cấp.',
  alternates: { canonical: '/marketplace' },
};

const TYPES = [
  { key: '', label: 'Tất cả', icon: 'ic-grid' },
  { key: 'need_contractor', label: 'Tìm nhà thầu', icon: 'ic-building' },
  { key: 'need_crew', label: 'Tìm đội thi công', icon: 'ic-worker' },
  { key: 'need_supplier', label: 'Tìm nhà cung cấp', icon: 'ic-bricks' },
  { key: 'partnership', label: 'Hợp tác', icon: 'ic-people' },
  { key: 'offer_service', label: 'Chào dịch vụ', icon: 'ic-tag' },
];

const SORTS = [
  { value: 'new', label: 'Mới nhất' },
  { value: 'deadline', label: 'Sắp hết hạn' },
  { value: 'budget', label: 'Ngân sách cao nhất' },
  { value: 'quotes', label: 'Nhiều báo giá nhất' },
];

const PAGE_SIZE = 15;

type Filters = { type: string; q: string; province: string; category: string; bmin: string; bmax: string; soon: boolean; sort: string; page: number };

type Row = {
  id: string; type: string; title: string; description: string | null; category_id: string | null; province_code: string | null; location_text: string | null;
  budget_from: number | null; budget_to: number | null; deadline: string | null; is_featured: boolean; quote_count: number | null; created_at: string;
  companies: { name: string; slug: string; logo_url: string | null; verified_tier: string } | null;
};

type Cat = { id: string; parent_id: string | null; name: string; group_key: string; sort_order: number | null };

const fetchRefs = cachedPublic(async () => {
  const supa = createSupabasePublic();
  const [p, c] = await Promise.all([
    supa.from('provinces').select('code, name').order('name').limit(100),
    supa.from('categories').select('id, parent_id, name, group_key, sort_order').order('sort_order'),
  ]);
  if (p.error) throw p.error;
  if (c.error) throw c.error;
  return { provinces: (p.data ?? []) as { code: string; name: string }[], categories: (c.data ?? []) as Cat[] };
}, 'mk-refs', 3600);

async function getRefs() {
  if (!SUPABASE_URL) return { provinces: [], categories: [] as Cat[] };
  try {
    return await fetchRefs();
  } catch {
    return { provinces: [], categories: [] as Cat[] };
  }
}

/** Số tiền nhập theo đơn vị triệu đồng → VND; rỗng/không hợp lệ → null. */
const million = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return v && isFinite(n) && n > 0 ? Math.round(n * 1e6) : null;
};

const fetchListings = cachedPublic(async (f: Filters, catIds: string[]): Promise<{ rows: Row[]; total: number }> => {
  let q = createSupabasePublic()
    .from('marketplace_listings')
    .select(
      'id, type, title, description, category_id, province_code, location_text, budget_from, budget_to, deadline, is_featured, quote_count, created_at, companies ( name, slug, logo_url, verified_tier )',
      { count: 'exact' },
    )
    .eq('status', 'open')
    .is('deleted_at', null);
  if (f.type) q = q.eq('type', f.type);
  if (f.province) q = q.eq('province_code', f.province);
  if (catIds.length) q = q.in('category_id', catIds);
  if (f.q) q = q.textSearch('search_tsv', f.q, { config: 'vn', type: 'websearch' });

  // Khoảng ngân sách giao nhau với [bmin, bmax] (budget_from ≤ budget_to)
  const lo = million(f.bmin);
  const hi = million(f.bmax);
  const conds: string[] = [];
  if (lo) conds.push(`or(budget_to.gte.${lo},budget_from.gte.${lo})`);
  if (hi) conds.push(`or(budget_from.lte.${hi},budget_to.lte.${hi})`);
  if (conds.length) q = q.or(conds.length === 1 ? conds[0].slice(3, -1) : `and(${conds.join(',')})`);

  const today = new Date();
  if (f.soon || f.sort === 'deadline') q = q.gte('deadline', today.toISOString().slice(0, 10));
  if (f.soon) q = q.lte('deadline', new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10));

  if (f.sort === 'deadline') q = q.order('deadline', { ascending: true });
  else if (f.sort === 'budget') q = q.order('budget_to', { ascending: false, nullsFirst: false }).order('budget_from', { ascending: false, nullsFirst: false });
  else if (f.sort === 'quotes') q = q.order('quote_count', { ascending: false });
  else q = q.order('is_featured', { ascending: false }).order('created_at', { ascending: false });

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Row[], total: count ?? 0 };
}, 'listings-v2', 30);

async function getListings(f: Filters, catIds: string[]) {
  if (!SUPABASE_URL) return { rows: [] as Row[], total: 0 };
  try {
    return await fetchListings(f, catIds);
  } catch {
    return { rows: [] as Row[], total: 0 };
  }
}

type RawParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? '').trim();

export default async function MarketplacePage({ searchParams }: { searchParams: RawParams }) {
  const f: Filters = {
    type: TYPE_LABEL[str(searchParams.type)] ? str(searchParams.type) : '',
    q: str(searchParams.q).slice(0, 100),
    province: str(searchParams.province),
    category: str(searchParams.category),
    bmin: str(searchParams.bmin),
    bmax: str(searchParams.bmax),
    soon: str(searchParams.soon) === '1',
    sort: SORTS.some((s) => s.value === str(searchParams.sort)) ? str(searchParams.sort) : 'new',
    page: Math.max(1, parseInt(str(searchParams.page) || '1', 10) || 1),
  };
  const activeType = f.type;
  const { provinces, categories } = await getRefs();
  const catIds = f.category ? categories.filter((c) => c.id === f.category || c.parent_id === f.category).map((c) => c.id) : [];
  const { rows: listings, total } = await getListings(f, catIds);
  const provName = new Map(provinces.map((p) => [p.code, p.name]));
  const topCats = categories.filter((c) => !c.parent_id);
  const pages = Math.ceil(total / PAGE_SIZE);

  const qsOf = (o: Partial<Filters>) => {
    const m = { ...f, ...o };
    const u = new URLSearchParams();
    if (m.type) u.set('type', m.type);
    if (m.q) u.set('q', m.q);
    if (m.province) u.set('province', m.province);
    if (m.category) u.set('category', m.category);
    if (m.bmin) u.set('bmin', m.bmin);
    if (m.bmax) u.set('bmax', m.bmax);
    if (m.soon) u.set('soon', '1');
    if (m.sort !== 'new') u.set('sort', m.sort);
    return u.toString();
  };
  const nActive = [f.q, f.province, f.category, f.bmin || f.bmax, f.soon].filter(Boolean).length;
  const hasFilter = nActive > 0;

  return (
    <>
      <style>{`
        .type-tabs{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}
        .type-tab{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:600;color:var(--text);text-decoration:none;transition:.15s}
        .type-tab svg{width:17px;height:17px;color:var(--muted)}
        .type-tab.active{background:var(--navy);color:#fff;border-color:var(--navy)}
        .type-tab.active svg{color:var(--orange-2)}
        .type-tab:hover:not(.active){border-color:var(--orange)}
        .listing{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow-sm);transition:.2s;display:block;text-decoration:none;color:inherit}
        .listing:hover{box-shadow:var(--shadow);border-color:#dfe6ee}
        .listing.feat{border-color:#ffdca6;background:linear-gradient(0deg,#fffdf9,#fff)}
        .listing .htop{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;align-items:flex-start}
        .listing h3{font-size:17px;font-weight:700;color:var(--navy);line-height:1.3}
        .listing .desc{font-size:13.5px;color:#31414f;margin:8px 0 12px}
        .listing .lmeta{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-bottom:12px}
        .listing .lmeta span{display:flex;align-items:center;gap:5px}
        .listing .lmeta svg{width:14px;height:14px}
        .listing .foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line-2);padding-top:12px;gap:12px;flex-wrap:wrap}
        .poster{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text)}
        .poster .pava{width:28px;height:28px;border-radius:7px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:11px;flex:none}
        .budget{font-size:15px;font-weight:800;color:var(--green)}
        .sort-sel{width:auto;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:#fff;color:var(--text)}
        .clear-f{font-size:12.5px;color:var(--orange);font-weight:600;text-decoration:none}
        @media(max-width:760px){.type-tabs{gap:6px}.type-tab{padding:8px 12px;font-size:12.5px}}
      `}</style>

      {/* Page head */}
      <div className="pagehead">
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span>Nhu cầu &amp; Báo giá</span>
          </div>
          <div className="between">
            <div>
              <h1>Nhu cầu &amp; Báo giá (Marketplace)</h1>
              <p>Nơi kết nối cung – cầu ngành xây dựng. Đăng nhu cầu → nhận nhiều báo giá → so sánh &amp; chọn đối tác.</p>
            </div>
            <a className="btn btn-ghost" href="/marketplace/new">
              <svg className="ic"><use href="#ic-plus" /></svg> Đăng nhu cầu
            </a>
          </div>
        </div>
      </div>

      <section className="block" style={{ paddingTop: 26, background: 'var(--bg)' }}>
        <div className="container"><AdSlot slot="marketplace_top" /></div>
        <div className="container">
          {/* Type tabs (pill style) */}
          <div className="type-tabs">
            {TYPES.map((t) => (
              <a
                key={t.key}
                href={`/marketplace?${qsOf({ type: t.key })}`}
                className={`type-tab${activeType === t.key ? ' active' : ''}`}
              >
                <svg className="ic"><use href={`#${t.icon}`} /></svg>
                {t.label}
              </a>
            ))}
          </div>

          <div className="grid-side">
            {/* Filter sidebar — trên điện thoại thu gọn sau nút "Bộ lọc" */}
            <input type="checkbox" id="filter-toggle" className="filter-toggle" hidden />
            <label htmlFor="filter-toggle" className="filter-btn">
              <svg className="ic"><use href="#ic-sliders" /></svg>
              Bộ lọc{nActive > 0 && <span className="n">{nActive}</span>}
              <svg className="ic chev"><use href="#ic-chevron-down" /></svg>
            </label>
            <aside className="filter-card">
              <form method="GET" action="/marketplace">
                {activeType && <input type="hidden" name="type" value={activeType} />}
                {f.sort !== 'new' && <input type="hidden" name="sort" value={f.sort} />}

                <h4>Từ khóa</h4>
                <input className="input" name="q" defaultValue={f.q} placeholder="VD: xây nhà xưởng, sơn epoxy…" style={{ padding: '8px 10px' }} />

                <div className="divider" />
                <h4>Khu vực</h4>
                <select className="select" name="province" defaultValue={f.province} style={{ marginBottom: 4 }}>
                  <option value="">Toàn quốc</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>

                <h4>Lĩnh vực</h4>
                <select className="select" name="category" defaultValue={f.category}>
                  <option value="">Tất cả lĩnh vực</option>
                  {topCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="divider" />
                <h4>Ngân sách (triệu đ)</h4>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" name="bmin" inputMode="decimal" defaultValue={f.bmin} placeholder="Từ" aria-label="Ngân sách từ (triệu đồng)" style={{ padding: '8px 10px' }} />
                  <input className="input" name="bmax" inputMode="decimal" defaultValue={f.bmax} placeholder="Đến" aria-label="Ngân sách đến (triệu đồng)" style={{ padding: '8px 10px' }} />
                </div>

                <div className="divider" />
                <h4>Thời hạn</h4>
                <label className="fopt">
                  <input type="checkbox" name="soon" value="1" defaultChecked={f.soon} style={{ accentColor: 'var(--orange)' }} /> Hết hạn trong 7 ngày
                </label>

                <button className="btn btn-navy btn-block mt-16" type="submit">Áp dụng</button>
                {hasFilter && (
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <a className="clear-f" href={`/marketplace${activeType ? `?type=${activeType}` : ''}`}>Xóa bộ lọc</a>
                  </div>
                )}
              </form>
            </aside>

            {/* Listings */}
            <div>
              <form className="toolbar" method="GET" action="/marketplace">
                {Object.entries({ type: f.type, q: f.q, province: f.province, category: f.category, bmin: f.bmin, bmax: f.bmax, soon: f.soon ? '1' : '' })
                  .filter(([, v]) => v)
                  .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <div className="count">
                  <b>{total.toLocaleString('vi-VN')}</b> tin đang mở
                  {activeType ? ` · ${TYPE_LABEL[activeType]}` : ''}
                </div>
                <AutoSubmitSelect name="sort" value={f.sort} options={SORTS} label="Sắp xếp" />
              </form>

              {listings.length === 0 ? (
                <div className="card-block" style={{ textAlign: 'center', padding: 48 }}>
                  <svg className="ic" style={{ width: 48, height: 48, color: 'var(--line)', margin: '0 auto 16px', display: 'block' }}>
                    <use href="#ic-clipboard" />
                  </svg>
                  <p className="muted">{hasFilter ? 'Không có tin nào khớp bộ lọc.' : 'Chưa có tin đăng nào trong danh mục này.'}</p>
                  <a className="btn btn-orange mt-16" href="/marketplace/new">Đăng tin ngay</a>
                </div>
              ) : (
                <>
                  <div className="stack">
                    {listings.map((l) => {
                      const budget = fmtRange(l.budget_from, l.budget_to);
                      const co = l.companies;
                      const prov = l.province_code ? provName.get(l.province_code) : null;
                      const place = [l.location_text, prov].filter(Boolean).join(' · ');
                      const dl = daysLeft(l.deadline);
                      return (
                        <a key={l.id} className={`listing${l.is_featured ? ' feat' : ''}`} href={`/marketplace/${l.id}`}>
                          <div className="htop">
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                              {l.is_featured && (
                                <span className="badge orange">
                                  <svg className="ic"><use href="#ic-star-f" /></svg> Nổi bật
                                </span>
                              )}
                              <span className="badge">{TYPE_LABEL[l.type] ?? l.type}</span>
                            </div>
                            {dl && (
                              <span className={`badge ${dl.urgent ? 'orange' : 'green'}`}>
                                <svg className="ic"><use href="#ic-clock" /></svg> {dl.label}
                              </span>
                            )}
                          </div>
                          <h3>{l.title}</h3>
                          {l.description && (
                            <p className="desc">
                              {l.description.slice(0, 140)}{l.description.length > 140 ? '…' : ''}
                            </p>
                          )}
                          <div className="lmeta">
                            {place && (
                              <span><svg className="ic"><use href="#ic-pin" /></svg> {place}</span>
                            )}
                            {l.deadline && (
                              <span><svg className="ic"><use href="#ic-calendar" /></svg> Hạn: {fmtDate(l.deadline)}</span>
                            )}
                            <span>
                              <svg className="ic"><use href="#ic-file-text" /></svg>
                              {l.quote_count ?? 0} báo giá
                            </span>
                          </div>
                          <div className="foot">
                            <div className="poster">
                              {co?.logo_url ? (
                                <img className="pava" src={thumb(co.logo_url, 64)} alt="" style={{ objectFit: 'cover' }} />
                              ) : (
                                <span className="pava" style={{ background: colorFor(co?.slug ?? l.id) }}>{initials(co?.name ?? 'DN')}</span>
                              )}
                              <span>{co?.name ?? 'Doanh nghiệp'}</span>
                            </div>
                            <div className="row" style={{ gap: 14 }}>
                              {budget && <span className="budget">{budget}</span>}
                              <span className="badge gray">
                                <svg className="ic"><use href="#ic-file-text" /></svg>
                                {l.quote_count ?? 0} báo giá
                              </span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>

                  <Pagination base="/marketplace" qs={qsOf({})} page={f.page} pages={pages} />
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
