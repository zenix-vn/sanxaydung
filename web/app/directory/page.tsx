import type { Metadata } from 'next';
import { createSupabasePublic, cachedPublic } from '@/lib/supabase/public';
import { SUPABASE_URL } from '@/lib/env';
import type { Company } from '@/lib/types';

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

const TIER_COLORS: Record<string, string> = {
  gold: '#c08a1a',
  capability: '#0d6b3f',
  legal: '#12439c',
  none: '#555',
};

function initials(name: string) {
  return name
    .split(' ')
    .filter((w) => w.length > 1)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

type SP = {
  q?: string;
  category?: string;
  province?: string;
  verified?: string;
  group?: string;
  capability?: string;
  size?: string;
  sort?: string;
  page?: string;
};

const fetchSearch = cachedPublic(async (sp: SP): Promise<Company[]> => {
  const supa = createSupabasePublic();
  let categoryId: string | null = null;
  if (sp.category) {
    const { data, error } = await supa.from('categories').select('id').eq('slug', sp.category).maybeSingle();
    if (error) throw error;
    categoryId = data?.id ?? null;
  }
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const { data, error } = await supa.rpc('search_companies', {
    q: sp.q || null,
    _category: categoryId,
    _province: sp.province || null,
    _verified_only: sp.verified === 'true',
    _limit: 20,
    _offset: (page - 1) * 20,
    _group: sp.group || null,
  });
  if (error) throw error;
  return (data ?? []) as Company[];
}, 'dir-search', 60);

async function search(sp: SP): Promise<Company[]> {
  if (!SUPABASE_URL) return [];
  try {
    return await fetchSearch(sp);
  } catch {
    return [];
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

type RawParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function DirectoryPage({ searchParams }: { searchParams: RawParams }) {
  const sp: SP = {
    q: str(searchParams.q) || undefined,
    category: str(searchParams.category) || undefined,
    province: str(searchParams.province) || undefined,
    verified: str(searchParams.verified) || undefined,
    group: str(searchParams.group) || undefined,
    capability: str(searchParams.capability) || undefined,
    size: str(searchParams.size) || undefined,
    sort: str(searchParams.sort) || 'trust',
    page: str(searchParams.page) || '1',
  };

  const [companies, provinces] = await Promise.all([search(sp), getProvinces()]);

  const activeGroup = sp.group ?? '';
  const activeVerified = sp.verified === 'true';
  const currentPage = Math.max(1, parseInt(sp.page ?? '1'));

  // Build query string helper (excluding 'page')
  const baseQs = Object.entries(sp)
    .filter(([k, v]) => k !== 'page' && v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');

  // Active filter chips
  const chips: { label: string; removeKey: string }[] = [];
  if (sp.q) chips.push({ label: `"${sp.q}"`, removeKey: 'q' });
  if (sp.group) chips.push({ label: GROUP_LABELS[sp.group] ?? sp.group, removeKey: 'group' });
  if (sp.province) chips.push({ label: sp.province, removeKey: 'province' });
  if (sp.verified) chips.push({ label: 'Đã xác minh', removeKey: 'verified' });
  if (sp.capability) chips.push({ label: `Hạng ${sp.capability}`, removeKey: 'capability' });
  if (sp.size) chips.push({ label: sp.size, removeKey: 'size' });

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
        .viewtoggle{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
        .viewtoggle a{padding:8px 12px;color:var(--muted);display:grid;place-items:center;text-decoration:none}
        .viewtoggle a.active{background:var(--navy);color:#fff}
        .viewtoggle a svg{width:18px;height:18px}
        .sort-sel{width:auto;padding:8px 12px;border:1px solid var(--line);border-radius:8px;font-size:13.5px;background:#fff;color:var(--text)}
        .list-comp{text-decoration:none}
      `}</style>

      {/* Search band */}
      <section className="searchband">
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span>Danh bạ doanh nghiệp</span>
          </div>
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

          {/* FILTER SIDEBAR */}
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
                  <span className="cnt">{k === 'contractor' ? '3.204' : k === 'crew' ? '2.881' : k === 'supplier' ? '1.905' : '955'}</span>
                </label>
              ))}

              <div className="divider" />
              <h4>Mức xác minh</h4>
              <label className="fopt">
                <input type="checkbox" name="verified" value="true" defaultChecked={activeVerified} />
                <span className="verify legal" style={{ fontSize: 12 }}>
                  <svg className="ic"><use href="#ic-shield-check" /></svg>Pháp lý
                </span>
                <span className="cnt">4.120</span>
              </label>
              <label className="fopt">
                <input type="checkbox" name="verified_cap" value="true" />
                <span className="verify capability" style={{ fontSize: 12 }}>
                  <svg className="ic"><use href="#ic-award" /></svg>Năng lực
                </span>
                <span className="cnt">1.870</span>
              </label>
              <label className="fopt">
                <input type="checkbox" name="verified_gold" value="true" />
                <span className="verify gold" style={{ fontSize: 12 }}>
                  <svg className="ic"><use href="#ic-star-f" /></svg>Đối tác vàng
                </span>
                <span className="cnt">312</span>
              </label>

              <div className="divider" />
              <h4>Hạng năng lực</h4>
              {['I', 'II', 'III'].map((h) => (
                <label className="fopt" key={h}>
                  <input type="checkbox" name="capability" value={h} defaultChecked={sp.capability === h} />
                  Hạng {h}
                  <span className="cnt">{h === 'I' ? '640' : h === 'II' ? '1.230' : '2.480'}</span>
                </label>
              ))}

              <div className="divider" />
              <h4>Trust Score tối thiểu</h4>
              <input type="range" min="0" max="100" defaultValue="0" name="min_trust" style={{ width: '100%', accentColor: 'var(--orange)' }} />
              <div className="between" style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span>0</span><span><b style={{ color: 'var(--green)' }}>≥ 0</b></span><span>100</span>
              </div>

              <div className="divider" />
              <h4>Quy mô nhân sự</h4>
              {['1–10 người', '11–50 người', '51–200 người', 'Trên 200 người'].map((s) => (
                <label className="fopt" key={s}>
                  <input type="checkbox" name="size" value={s} defaultChecked={sp.size === s} /> {s}
                </label>
              ))}

              <div className="divider" />
              <button className="btn btn-navy btn-block mt-16" type="submit">Áp dụng bộ lọc</button>
            </form>
          </aside>

          {/* RESULTS */}
          <div>
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
                Tìm thấy <b>{companies.length}</b> doanh nghiệp
                {activeGroup ? ` · ${GROUP_LABELS[activeGroup]}` : ''}
                {sp.q ? ` · "${sp.q}"` : ''}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <form method="GET" action="/directory">
                  {sp.q && <input type="hidden" name="q" value={sp.q} />}
                  {sp.group && <input type="hidden" name="group" value={sp.group} />}
                  {sp.province && <input type="hidden" name="province" value={sp.province} />}
                  {sp.verified && <input type="hidden" name="verified" value={sp.verified} />}
                  <select className="sort-sel" name="sort" defaultValue={sp.sort} onChange={undefined}>
                    <option value="trust">Trust Score cao nhất</option>
                    <option value="rating">Đánh giá tốt nhất</option>
                    <option value="projects">Nhiều dự án nhất</option>
                    <option value="updated">Mới cập nhật</option>
                  </select>
                </form>
                <div className="viewtoggle">
                  <a className="active" title="Danh sách" href={`/directory${baseQs ? `?${baseQs}` : ''}`}>
                    <svg className="ic"><use href="#ic-grid" /></svg>
                  </a>
                  <a title="Bản đồ" href={`/directory?${baseQs}&view=map`}>
                    <svg className="ic"><use href="#ic-pin" /></svg>
                  </a>
                </div>
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
                            {c.province_code && (
                              <span>
                                <svg className="ic"><use href="#ic-pin" /></svg>
                                {c.province_code}
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
                            <span>
                              <svg className="ic"><use href="#ic-star-f" /></svg>
                              4.8 <span style={{ fontWeight: 400 }}>(12 đánh giá)</span>
                            </span>
                          </div>
                          {c.intro && (
                            <p className="tagline">{c.intro.slice(0, 120)}{c.intro.length > 120 ? '…' : ''}</p>
                          )}
                          <div className="cats">
                            <span className="badge gray">Tổng thầu</span>
                            <span className="badge gray">Nhà cao tầng</span>
                          </div>
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

                {/* Pagination */}
                {companies.length >= 20 && (
                  <div className="pagination">
                    {currentPage > 1 && (
                      <a href={`/directory?${baseQs}&page=${currentPage - 1}`}>
                        <svg className="ic"><use href="#ic-chevron-left" /></svg>
                      </a>
                    )}
                    {[currentPage - 1, currentPage, currentPage + 1, currentPage + 2]
                      .filter((p) => p >= 1 && p <= currentPage + 2)
                      .map((p) => (
                        <a key={p} className={p === currentPage ? 'active' : ''} href={`/directory?${baseQs}&page=${p}`}>
                          {p}
                        </a>
                      ))}
                    <a href={`/directory?${baseQs}&page=${currentPage + 1}`}>
                      <svg className="ic"><use href="#ic-chevron-right" /></svg>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
