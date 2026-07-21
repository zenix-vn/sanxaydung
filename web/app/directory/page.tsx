import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
};

async function search(sp: SP): Promise<Company[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();

    let categoryId: string | null = null;
    if (sp.category) {
      const { data } = await supa.from('categories').select('id').eq('slug', sp.category).maybeSingle();
      categoryId = data?.id ?? null;
    } else if (sp.group) {
      const { data } = await supa
        .from('categories')
        .select('id')
        .eq('group_key', sp.group)
        .limit(1)
        .maybeSingle();
      categoryId = data?.id ?? null;
    }

    const { data } = await supa.rpc('search_companies', {
      q: sp.q || null,
      _category: categoryId,
      _province: sp.province || null,
      _verified_only: sp.verified === 'true',
      _limit: 30,
      _offset: 0,
    });
    return (data ?? []) as Company[];
  } catch {
    return [];
  }
}

async function getProvinces() {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa.from('provinces').select('code, name').order('name').limit(63);
    return data ?? [];
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
  };

  const [companies, provinces] = await Promise.all([search(sp), getProvinces()]);

  const activeGroup = sp.group ?? '';
  const activeVerified = sp.verified === 'true';

  return (
    <>
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

          {/* ── FILTER SIDEBAR ── */}
          <aside className="filter-card">
            <form method="GET" action="/directory">
              {sp.q && <input type="hidden" name="q" value={sp.q} />}
              {sp.province && <input type="hidden" name="province" value={sp.province} />}

              <h4>Nhóm lĩnh vực</h4>
              {Object.entries(GROUP_LABELS).map(([k, v]) => (
                <label className="fopt" key={k}>
                  <input
                    type="radio"
                    name="group"
                    value={k}
                    defaultChecked={activeGroup === k}
                    style={{ accentColor: 'var(--orange)' }}
                  />
                  {v}
                </label>
              ))}
              {activeGroup && (
                <a href={`/directory${sp.q ? `?q=${sp.q}` : ''}`} style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600 }}>
                  Xóa bộ lọc
                </a>
              )}

              <div className="divider" />
              <h4>Mức xác minh</h4>
              <label className="fopt">
                <input
                  type="checkbox"
                  name="verified"
                  value="true"
                  defaultChecked={activeVerified}
                />
                <span className="verify legal" style={{ fontSize: 12 }}>
                  <svg className="ic"><use href="#ic-shield-check" /></svg>Đã xác minh
                </span>
              </label>

              <div className="divider" />
              <button className="btn btn-navy btn-block mt-16" type="submit">
                Áp dụng bộ lọc
              </button>
            </form>
          </aside>

          {/* ── RESULTS ── */}
          <div>
            <div className="toolbar">
              <div className="count">
                Tìm thấy <b>{companies.length}</b> doanh nghiệp
                {activeGroup ? ` · ${GROUP_LABELS[activeGroup]}` : ''}
                {sp.q ? ` · "${sp.q}"` : ''}
              </div>
            </div>

            {companies.length === 0 ? (
              <div className="card-block" style={{ textAlign: 'center', padding: 48 }}>
                <svg className="ic" style={{ width: 48, height: 48, color: 'var(--line)', margin: '0 auto 16px' }}>
                  <use href="#ic-search" />
                </svg>
                <p style={{ color: 'var(--muted)', fontSize: 15 }}>Không tìm thấy doanh nghiệp phù hợp.</p>
                <a className="btn btn-orange mt-16" href="/directory">Xóa tìm kiếm</a>
              </div>
            ) : (
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
                        </div>
                        {c.intro && (
                          <p className="tagline">{c.intro.slice(0, 120)}{c.intro.length > 120 ? '…' : ''}</p>
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
            )}
          </div>
        </div>
      </section>
    </>
  );
}
