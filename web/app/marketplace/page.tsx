import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPES = [
  { key: '', label: 'Tất cả', icon: 'ic-grid' },
  { key: 'need_contractor', label: 'Tìm nhà thầu', icon: 'ic-building' },
  { key: 'need_crew', label: 'Tìm đội thi công', icon: 'ic-worker' },
  { key: 'need_supplier', label: 'Tìm nhà cung cấp', icon: 'ic-bricks' },
  { key: 'partnership', label: 'Hợp tác', icon: 'ic-people' },
  { key: 'offer_service', label: 'Chào dịch vụ', icon: 'ic-tag' },
];

const TYPE_LABEL: Record<string, string> = {
  need_contractor: 'Tìm nhà thầu',
  need_crew: 'Tìm đội thi công',
  need_supplier: 'Tìm nhà cung cấp',
  partnership: 'Hợp tác',
  offer_service: 'Cung cấp dịch vụ',
  opportunity: 'Cơ hội',
};

function fmtBudget(from: number | null, to: number | null): string | null {
  if (!from && !to) return null;
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} triệu`;
    return n.toLocaleString('vi-VN');
  };
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `Từ ${fmt(from)}`;
  return `Đến ${fmt(to!)}`;
}

function daysLeft(deadline: string | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return { label: 'Hết hạn hôm nay', urgent: true };
  if (diff <= 3) return { label: `Còn ${diff} ngày`, urgent: true };
  return { label: `Còn ${diff} ngày`, urgent: false };
}

async function getListings(type?: string): Promise<Listing[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    let q = supa
      .from('marketplace_listings')
      .select('*')
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);
    if (type) q = q.eq('type', type);
    const { data } = await q;
    return (data ?? []) as Listing[];
  } catch {
    return [];
  }
}

type RawParams = { [key: string]: string | string[] | undefined };
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function MarketplacePage({ searchParams }: { searchParams: RawParams }) {
  const activeType = str(searchParams.type) || '';
  const listings = await getListings(activeType || undefined);

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
            <a className="btn btn-ghost" href="/login">
              <svg className="ic"><use href="#ic-plus" /></svg> Đăng nhu cầu
            </a>
          </div>
        </div>
      </div>

      <section className="block" style={{ paddingTop: 26, background: 'var(--bg)' }}>
        <div className="container">
          {/* Type tabs (pill style) */}
          <div className="type-tabs">
            {TYPES.map((t) => (
              <a
                key={t.key}
                href={`/marketplace${t.key ? `?type=${t.key}` : ''}`}
                className={`type-tab${activeType === t.key ? ' active' : ''}`}
              >
                <svg className="ic"><use href={`#${t.icon}`} /></svg>
                {t.label}
              </a>
            ))}
          </div>

          <div className="grid-side">
            {/* Filter sidebar */}
            <aside className="filter-card">
              <form method="GET" action="/marketplace">
                {activeType && <input type="hidden" name="type" value={activeType} />}

                <h4>Khu vực</h4>
                <select className="select" name="province" style={{ marginBottom: 4 }}>
                  <option value="">Toàn quốc</option>
                  <option>Hà Nội</option>
                  <option>TP. Hồ Chí Minh</option>
                  <option>Đà Nẵng</option>
                  <option>Bình Dương</option>
                  <option>Long An</option>
                </select>

                <h4>Lĩnh vực</h4>
                {['Xây dựng dân dụng', 'Cơ điện M&E', 'Hoàn thiện – Sơn', 'Nhôm kính', 'Vật liệu xây dựng'].map((f) => (
                  <label className="fopt" key={f}>
                    <input type="checkbox" name="field" value={f} style={{ accentColor: 'var(--orange)' }} /> {f}
                  </label>
                ))}

                <div className="divider" />
                <h4>Ngân sách (triệu đ)</h4>
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" name="budget_from" placeholder="Từ" style={{ padding: '8px 10px' }} />
                  <input className="input" name="budget_to" placeholder="Đến" style={{ padding: '8px 10px' }} />
                </div>

                <div className="divider" />
                <h4>Trạng thái</h4>
                <label className="fopt">
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--orange)' }} /> Đang mở
                </label>
                <label className="fopt">
                  <input type="checkbox" style={{ accentColor: 'var(--orange)' }} /> Sắp hết hạn
                </label>
                <label className="fopt">
                  <input type="checkbox" style={{ accentColor: 'var(--orange)' }} /> Có hồ sơ mời thầu
                </label>

                <button className="btn btn-navy btn-block mt-16" type="submit">Áp dụng</button>
              </form>
            </aside>

            {/* Listings */}
            <div>
              <div className="toolbar">
                <div className="count">
                  <b>{listings.length}</b> tin đang mở
                  {activeType ? ` · ${TYPE_LABEL[activeType]}` : ''}
                </div>
                <select className="sort-sel">
                  <option>Mới nhất</option>
                  <option>Sắp hết hạn</option>
                  <option>Ngân sách cao nhất</option>
                  <option>Nhiều báo giá nhất</option>
                </select>
              </div>

              {listings.length === 0 ? (
                <div className="card-block" style={{ textAlign: 'center', padding: 48 }}>
                  <svg className="ic" style={{ width: 48, height: 48, color: 'var(--line)', margin: '0 auto 16px', display: 'block' }}>
                    <use href="#ic-clipboard" />
                  </svg>
                  <p className="muted">Chưa có tin đăng nào trong danh mục này.</p>
                  <a className="btn btn-orange mt-16" href="/login">Đăng tin ngay</a>
                </div>
              ) : (
                <>
                  <div className="stack">
                    {listings.map((l) => {
                      const budget = fmtBudget(l.budget_from, l.budget_to);
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
                            {l.location_text && (
                              <span><svg className="ic"><use href="#ic-pin" /></svg> {l.location_text}</span>
                            )}
                            {l.deadline && (
                              <span><svg className="ic"><use href="#ic-calendar" /></svg> HN: {new Date(l.deadline).toLocaleDateString('vi-VN')}</span>
                            )}
                            <span>
                              <svg className="ic"><use href="#ic-file-text" /></svg>
                              {l.quote_count ?? 0} báo giá
                            </span>
                          </div>
                          <div className="foot">
                            <div className="poster">
                              <span className="pava" style={{ background: 'var(--navy)' }}>
                                {(l.company_name ?? 'DN').split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? 'D'}
                              </span>
                              <span>{l.company_name ?? 'Doanh nghiệp'}</span>
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

                  <div className="pill-note mt-24">
                    <svg className="ic"><use href="#ic-shield" /></svg>
                    <span>
                      Gói <b>ưu tiên đăng tin</b> giúp tin của bạn hiển thị đầu danh sách &amp; gắn nhãn &ldquo;Nổi bật&rdquo;.{' '}
                      <a href="/pricing" style={{ color: 'var(--orange)', fontWeight: 600 }}>Xem gói →</a>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
