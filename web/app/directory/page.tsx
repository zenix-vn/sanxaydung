import type { Metadata } from 'next';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import SortSelect from './SortSelect';
import Pagination from '@/components/Pagination';
import { TIER_COLORS } from '@/lib/format';
import { initials } from '@/lib/ui';
import AdSlot from '@/components/AdSlot';
import { TrackImpressions } from '@/components/Track';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tìm nhà thầu, đội thi công, nhà cung cấp',
  description: 'Danh bạ doanh nghiệp xây dựng Việt Nam: nhà thầu, đội thi công, nhà cung cấp vật liệu — lọc theo lĩnh vực, khu vực, mức độ xác minh.',
  alternates: { canonical: '/directory' },
};

const GROUP_LABELS: Record<string, string> = {
  contractor: 'Nhà thầu',
  crew: 'Đội thi công',
  supplier: 'Nhà cung cấp',
  service: 'Đơn vị dịch vụ',
};

type SP = {
  q?: string;
  category?: string;
  province?: string;
  verified?: string;
  group?: string;
  sort?: string;
  page?: string;
};

type Item = {
  id: string; slug: string; name: string; logo_url: string | null; intro: string | null; verified_tier: string;
  trust_score: number | null; size_range: string | null; founded_year: number | null; province: string | null; location_count: number;
  categories: string[]; category_count: number; rating: number | null; review_count: number;
};
type Result = { total: number; items: Item[] };
const PAGE_SIZE = 20;

const fetchSearch = cachedPublic(async (sp: SP): Promise<Result> => {
  const supa = createSupabasePublic();
  let categoryId: string | null = null;
  if (sp.category) {
    const { data, error } = await supa.from('categories').select('id').eq('slug', sp.category).maybeSingle();
    if (error) throw error;
    categoryId = data?.id ?? null;
  }
  const page = pageNo(sp.page);
  const { data, error } = await supa.rpc('directory_search', {
    q: sp.q || null,
    _category: categoryId,
    _province: sp.province || null,
    _verified_only: sp.verified === 'true',
    _group: sp.group || null,
    _sort: sp.sort || 'trust',
    _limit: PAGE_SIZE,
    _offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw error;
  return data as Result;
}, 'dir-search-v2', 60);

const pageNo = (v?: string) => Math.max(1, parseInt(v ?? '1', 10) || 1);

async function search(sp: SP): Promise<Result> {
  if (!SUPABASE_URL) return { total: 0, items: [] };
  try {
    return await fetchSearch(sp);
  } catch {
    return { total: 0, items: [] };
  }
}

const fetchProvinces = cachedPublic(async () => {
  const { data, error } = await createSupabasePublic().from('provinces').select('code, name').order('name').limit(63);
  if (error) throw error;
  return data ?? [];
}, 'provinces', 3600);

async function getProvinces() {
  if (!SUPABASE_URL) return [];
  try {
    return await fetchProvinces();
  } catch {
    return [];
  }
}

const fetchCounts = cachedPublic(async () => {
  const { data, error } = await createSupabasePublic().rpc('home_stats');
  if (error) throw error;
  const d = data as { verified?: number; groups?: Record<string, number> } | null;
  return { verified: d?.verified ?? 0, groups: d?.groups ?? {} };
}, 'dir-counts', 300);

async function getCounts() {
  if (!SUPABASE_URL) return null;
  try {
    return await fetchCounts();
  } catch {
    return null;
  }
}

const nf = new Intl.NumberFormat('vi-VN');

type RawParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function DirectoryPage({ searchParams }: { searchParams: RawParams }) {
  const sp: SP = {
    q: str(searchParams.q) || undefined,
    category: str(searchParams.category) || undefined,
    province: str(searchParams.province) || undefined,
    verified: str(searchParams.verified) || undefined,
    group: str(searchParams.group) || undefined,
    sort: str(searchParams.sort) || 'trust',
    page: str(searchParams.page) || '1',
  };

  const [{ items: companies, total }, provinces, counts] = await Promise.all([search(sp), getProvinces(), getCounts()]);

  const activeGroup = sp.group ?? '';
  const activeVerified = sp.verified === 'true';
  const currentPage = pageNo(sp.page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build query string helper (excluding 'page')
  const baseQs = Object.entries(sp)
    .filter(([k, v]) => k !== 'page' && v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');

  // Active filter chips
  const chips: { label: string; removeKey: string }[] = [];
  if (sp.q) chips.push({ label: `"${sp.q}"`, removeKey: 'q' });
  if (sp.group) chips.push({ label: GROUP_LABELS[sp.group] ?? sp.group, removeKey: 'group' });
  if (sp.province) chips.push({ label: provinces.find((p) => p.code === sp.province)?.name ?? sp.province, removeKey: 'province' });
  if (sp.verified) chips.push({ label: 'Đã xác minh', removeKey: 'verified' });

  const nActive = (sp.group ? 1 : 0) + (sp.verified ? 1 : 0);

  function removeChipUrl(key: string) {
    const params = { ...sp } as Record<string, string | undefined>;
    delete params[key];
    delete params['page'];
    return '/directory?' + Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
  }

  return (
    <>
      <style>{`
        .pagination{display:flex;gap:6px;justify-content:center;margin-top:28px}
        .pagination a{min-width:38px;height:38px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;font-size:14px;font-weight:600;color:var(--text);background:#fff;text-decoration:none}
        .pagination a.active{background:var(--navy);color:#fff;border-color:var(--navy)}
        .pagination a:hover:not(.active){border-color:var(--orange);color:var(--orange)}
        .chips-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .chip-active{display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:6px 12px;border-radius:20px;background:var(--navy);color:#fff;text-decoration:none}
        .chip-active svg{width:14px;height:14px}
        .sort-sel{width:auto;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:#fff;color:var(--text)}
        .list-comp{text-decoration:none}
        .dir-h1{font-size:22px;font-weight:800;color:#fff;margin:6px 0 14px}
      `}</style>

      {/* Search band */}
      <section className="searchband">
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span>Danh bạ doanh nghiệp</span>
          </div>
          <h1 className="dir-h1">
            {activeGroup ? GROUP_LABELS[activeGroup] ?? 'Doanh nghiệp' : 'Doanh nghiệp xây dựng'}
            {sp.province ? ` tại ${provinces.find((p) => p.code === sp.province)?.name ?? ''}` : ' trên toàn quốc'}
          </h1>
          <form className="dir-searchbar" action="/directory">
            <div className="fld">
              <svg className="ic"><use href="#ic-search" /></svg>
              <input
                name="q"
                defaultValue={sp.q ?? ''}
                placeholder="Tên doanh nghiệp, lĩnh vực… (vd: xây trọn gói, điện nước)"
              />
            </div>
            <div className="fld">
              <svg className="ic"><use href="#ic-pin" /></svg>
              <select name="province" defaultValue={sp.province ?? ''}>
                <option value="">Toàn quốc</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <svg className="ic"><use href="#ic-briefcase" /></svg>
              <select name="group" defaultValue={activeGroup}>
                <option value="">Tất cả lĩnh vực</option>
                {Object.entries(GROUP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-orange" type="submit">Tìm kiếm</button>
          </form>
        </div>
      </section>

      {/* Main content */}
      <section className="block" style={{ paddingTop: 28, background: 'var(--bg)' }}>
        <div className="container grid-side">

          {/* FILTER SIDEBAR — trên điện thoại thu gọn sau nút "Bộ lọc" */}
          <input type="checkbox" id="filter-toggle" className="filter-toggle" hidden />
          <label htmlFor="filter-toggle" className="filter-btn">
            <svg className="ic"><use href="#ic-sliders" /></svg>
            Bộ lọc{nActive > 0 && <span className="n">{nActive}</span>}
            <svg className="ic chev"><use href="#ic-chevron-down" /></svg>
          </label>
          <aside className="filter-card">
            <form method="GET" action="/directory">
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.province && <input type="hidden" name="province" value={sp.province} />}
              {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}

              <h4>
                Nhóm lĩnh vực
                {activeGroup && (
                  <a href="/directory" style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>Xóa</a>
                )}
              </h4>
              {Object.entries(GROUP_LABELS).map(([k, v]) => (
                <label className="fopt" key={k}>
                  <input
                    type="radio"
                    name="group"
                    value={k}
                    defaultChecked={activeGroup === k}
                  />
                  {v}
                  {counts && <span className="cnt">{nf.format(counts.groups[k] ?? 0)}</span>}
                </label>
              ))}

              <div className="divider" />
              <h4>Mức xác minh</h4>
              <label className="fopt">
                <input type="checkbox" name="verified" value="true" defaultChecked={activeVerified} />
                <span className="verify legal" style={{ fontSize: 12 }}>
                  <svg className="ic"><use href="#ic-shield-check" /></svg>Đã xác minh
                </span>
                {counts && <span className="cnt">{nf.format(counts.verified)}</span>}
              </label>

              <button className="btn btn-navy btn-block mt-16" type="submit">Áp dụng bộ lọc</button>
            </form>
          </aside>

          {/* RESULTS */}
          <div>
            <AdSlot slot="directory_top" />
            {/* Active filter chips */}
            {chips.length > 0 && (
              <div className="chips-row">
                {chips.map((chip) => (
                  <a key={chip.removeKey} className="chip-active" href={removeChipUrl(chip.removeKey)}>
                    {chip.label}
                    <svg className="ic"><use href="#ic-x" /></svg>
                  </a>
                ))}
                <a href="/directory" style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, alignSelf: 'center' }}>
                  Xóa tất cả
                </a>
              </div>
            )}

            <div className="toolbar">
              <div className="count">
                Tìm thấy <b>{nf.format(total)}</b> doanh nghiệp
                {activeGroup ? ` · ${GROUP_LABELS[activeGroup]}` : ''}
                {sp.q ? ` · "${sp.q}"` : ''}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <form method="GET" action="/directory">
                  {sp.q && <input type="hidden" name="q" value={sp.q} />}
                  {sp.group && <input type="hidden" name="group" value={sp.group} />}
                  {sp.province && <input type="hidden" name="province" value={sp.province} />}
                  {sp.verified && <input type="hidden" name="verified" value={sp.verified} />}
                  <SortSelect value={sp.sort ?? 'trust'} />
                </form>
              </div>
            </div>

            {companies.length === 0 ? (
              <div className="card-block" style={{ textAlign: 'center', padding: 48 }}>
                <svg className="ic" style={{ width: 48, height: 48, color: 'var(--line)', margin: '0 auto 16px', display: 'block' }}>
                  <use href="#ic-search" />
                </svg>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>Không tìm thấy doanh nghiệp phù hợp.</p>
                <a className="btn btn-orange mt-16" href="/directory">Xóa tìm kiếm</a>
              </div>
            ) : (
              <>
                <div className="stack">
                  <TrackImpressions ids={companies.map((c) => c.id)} />
                  {companies.map((c) => {
                    const ini = initials(c.name);
                    const color = TIER_COLORS[c.verified_tier] ?? '#555';
                    const trust = Math.round(c.trust_score ?? 0);
                    return (
                      <a key={c.id} className="list-comp" href={`/cong-ty/${c.slug}`}>
                        {/* Logo */}
                        <div className="lg" style={{ background: c.logo_url ? '#fff' : color }}>
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }} />
                          ) : ini}
                        </div>

                        {/* Info */}
                        <div>
                          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                            <h3>{c.name}</h3>
                            {c.verified_tier === 'gold' && (
                              <span className="verify gold" style={{ fontSize: 11 }}>
                                <svg className="ic"><use href="#ic-star-f" /></svg>Đối tác vàng
                              </span>
                            )}
                            {c.verified_tier === 'capability' && (
                              <span className="verify capability" style={{ fontSize: 11 }}>
                                <svg className="ic"><use href="#ic-award" /></svg>Xác minh năng lực
                              </span>
                            )}
                            {c.verified_tier === 'legal' && (
                              <span className="verify legal" style={{ fontSize: 11 }}>
                                <svg className="ic"><use href="#ic-shield-check" /></svg>Xác minh pháp lý
                              </span>
                            )}
                          </div>
                          <div className="meta">
                            {c.province && (
                              <span>
                                <svg className="ic"><use href="#ic-pin" /></svg>
                                {c.province}{c.location_count > 1 ? ` +${c.location_count - 1}` : ''}
                              </span>
                            )}
                            {c.size_range && (
                              <span>
                                <svg className="ic"><use href="#ic-users" /></svg>
                                {c.size_range}
                              </span>
                            )}
                            {c.founded_year && (
                              <span>
                                <svg className="ic"><use href="#ic-clock" /></svg>
                                Thành lập {c.founded_year}
                              </span>
                            )}
                            {c.review_count > 0 && (
                              <span>
                                <svg className="ic"><use href="#ic-star-f" /></svg>
                                {c.rating} <span style={{ fontWeight: 400 }}>({c.review_count} đánh giá)</span>
                              </span>
                            )}
                          </div>
                          {c.intro && (
                            <p className="tagline">{c.intro.slice(0, 120)}{c.intro.length > 120 ? '…' : ''}</p>
                          )}
                          {c.categories.length > 0 && (
                            <div className="cats">
                              {c.categories.map((name) => <span key={name} className="badge gray">{name}</span>)}
                              {c.category_count > c.categories.length && <span className="badge gray">+{c.category_count - c.categories.length}</span>}
                            </div>
                          )}
                        </div>

                        {/* Trust score + CTA */}
                        <div className="side">
                          <div className="ts-pill">
                            <b>{trust}</b>
                            <small>TRUST SCORE</small>
                          </div>
                          <span className="btn btn-outline btn-sm">Xem hồ sơ</span>
                        </div>
                      </a>
                    );
                  })}
                </div>

                <Pagination base="/directory" qs={baseQs} page={currentPage} pages={pages} />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
