import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Listing } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPES = [
  { key: '', label: 'Tất cả' },
  { key: 'need_contractor', label: 'Tìm nhà thầu' },
  { key: 'need_crew', label: 'Tìm đội thi công' },
  { key: 'need_supplier', label: 'Tìm nhà cung cấp' },
  { key: 'partnership', label: 'Hợp tác' },
  { key: 'offer_service', label: 'Cung cấp dịch vụ' },
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

function daysLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return 'Hết hạn hôm nay';
  return `còn ${diff} ngày`;
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
      {/* Page head */}
      <div className="pagehead">
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span>Nhu cầu &amp; Báo giá</span>
          </div>
          <h1>Nhu cầu &amp; Cơ hội</h1>
          <p>Tìm kiếm hợp đồng, đối tác và cơ hội kinh doanh trong ngành xây dựng</p>
        </div>
      </div>

      <section className="block" style={{ paddingTop: 0, background: 'var(--bg)' }}>
        <div className="container">

          {/* Type tabs */}
          <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
            <nav className="tabs">
              {TYPES.map((t) => (
                <a
                  key={t.key}
                  href={`/marketplace${t.key ? `?type=${t.key}` : ''}`}
                  className={activeType === t.key ? 'active' : ''}
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <div className="count">
              <b>{listings.length}</b> tin đăng
              {activeType ? ` · ${TYPE_LABEL[activeType]}` : ''}
            </div>
            <a className="btn btn-orange btn-sm" href="/login">
              <svg className="ic"><use href="#ic-plus" /></svg> Đăng nhu cầu
            </a>
          </div>

          {/* Listings */}
          {listings.length === 0 ? (
            <div className="card-block" style={{ textAlign: 'center', padding: 48 }}>
              <p className="muted">Chưa có tin đăng nào trong danh mục này.</p>
              <a className="btn btn-orange mt-16" href="/login">Đăng tin ngay</a>
            </div>
          ) : (
            <div className="stack">
              {listings.map((l) => {
                const budget = fmtBudget(l.budget_from, l.budget_to);
                const dl = daysLeft(l.deadline);
                return (
                  <a key={l.id} className="list-comp" href={`/marketplace/${l.id}`}>
                    {/* Icon block */}
                    <div
                      className="lg"
                      style={{
                        background: l.is_featured ? 'var(--orange)' : 'var(--navy)',
                        fontSize: 14,
                        borderRadius: 12,
                      }}
                    >
                      <svg className="ic" style={{ width: 28, height: 28 }}>
                        <use href={l.is_featured ? '#ic-star-f' : '#ic-clipboard'} />
                      </svg>
                    </div>

                    {/* Main info */}
                    <div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        {l.is_featured && <span className="badge orange">Nổi bật</span>}
                        <span className="badge">{TYPE_LABEL[l.type] ?? l.type}</span>
                        {dl && <span className="badge green">{dl}</span>}
                      </div>
                      <h3>{l.title}</h3>
                      {l.description && (
                        <p className="tagline" style={{ marginTop: 6 }}>
                          {l.description.slice(0, 140)}{l.description.length > 140 ? '…' : ''}
                        </p>
                      )}
                      <div className="meta" style={{ marginTop: 8 }}>
                        {budget && (
                          <span>
                            <svg className="ic"><use href="#ic-coin" /></svg>
                            {budget}
                          </span>
                        )}
                        {l.deadline && (
                          <span>
                            <svg className="ic"><use href="#ic-clock" /></svg>
                            HN: {new Date(l.deadline).toLocaleDateString('vi-VN')}
                          </span>
                        )}
                        <span>
                          <svg className="ic"><use href="#ic-file-text" /></svg>
                          {l.quote_count ?? 0} báo giá
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="side">
                      <span className="btn btn-orange btn-sm">Xem chi tiết</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
