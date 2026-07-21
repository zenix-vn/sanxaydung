import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Listing } from '@/lib/types';
import QuoteForm from './QuoteForm';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  need_contractor: 'Tìm nhà thầu',
  need_crew: 'Tìm đội thi công',
  need_supplier: 'Tìm nhà cung cấp',
  partnership: 'Hợp tác',
  offer_service: 'Cung cấp dịch vụ',
  opportunity: 'Cơ hội',
};

function fmtBudget(from: number | null, to: number | null): string {
  if (!from && !to) return 'Thương lượng';
  const fmt = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)} tỷ`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} triệu`;
    return n.toLocaleString('vi-VN');
  };
  if (from && to) return `${fmt(from)} – ${fmt(to)} đồng`;
  if (from) return `Từ ${fmt(from)} đồng`;
  return `Đến ${fmt(to!)} đồng`;
}

function daysLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Đã hết hạn';
  if (diff === 0) return 'Hết hạn hôm nay';
  return `còn ${diff} ngày`;
}

async function getListing(id: string): Promise<(Listing & { companies?: { name: string; trust_score: number; verified_tier: string; slug: string } | null }) | null> {
  if (!SUPABASE_URL) return null;
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('marketplace_listings')
      .select('*, companies ( name, trust_score, verified_tier, slug )')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function getSimilar(id: string, type: string): Promise<Listing[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('marketplace_listings')
      .select('id, title, type')
      .eq('status', 'open')
      .eq('type', type)
      .neq('id', id)
      .is('deleted_at', null)
      .limit(4);
    return (data ?? []) as Listing[];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const l = await getListing(params.id);
  if (!l) return { title: 'Không tìm thấy tin đăng' };
  return { title: l.title, description: l.description?.slice(0, 160) ?? undefined };
}

export default async function MarketplaceDetailPage({ params }: { params: { id: string } }) {
  const l = await getListing(params.id);
  if (!l) notFound();

  const similar = await getSimilar(params.id, l.type);
  const company = l.companies;
  const dl = daysLeft(l.deadline);
  const typeLabel = TYPE_LABEL[l.type] ?? l.type;
  const ini = company ? company.name.split(' ').slice(-2).map((w: string) => w[0]?.toUpperCase()).join('') : '??';

  return (
    <>
      {/* Breadcrumb */}
      <div className="pagehead" style={{ padding: '18px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/">Trang chủ</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <a href="/marketplace">Nhu cầu &amp; Báo giá</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            <span style={{ color: '#fff' }}>Chi tiết tin</span>
          </div>
        </div>
      </div>

      <section className="block" style={{ paddingTop: 26, background: 'var(--bg)' }}>
        <div className="container grid-side-r">

          {/* ── MAIN ── */}
          <div>

            {/* Header */}
            <div className="card-block">
              <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                {l.is_featured && (
                  <span className="badge orange">
                    <svg className="ic"><use href="#ic-star-f" /></svg> Nổi bật
                  </span>
                )}
                <span className="badge">{typeLabel}</span>
                {dl && (
                  <span className={`badge ${dl === 'Đã hết hạn' ? 'red' : 'green'}`}>
                    <svg className="ic"><use href="#ic-clock" /></svg>
                    {l.status === 'open' ? `Đang mở · ${dl}` : 'Đã đóng'}
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.3 }}>
                {l.title}
              </h1>

              {/* Meta grid */}
              <div className="rfq-meta">
                <div className="m">
                  <small>
                    <svg className="ic"><use href="#ic-coin" /></svg> Ngân sách
                  </small>
                  <b>{fmtBudget(l.budget_from, l.budget_to)}</b>
                </div>
                <div className="m">
                  <small>
                    <svg className="ic"><use href="#ic-pin" /></svg> Địa điểm
                  </small>
                  <b>Toàn quốc</b>
                </div>
                <div className="m">
                  <small>
                    <svg className="ic"><use href="#ic-file-text" /></svg> Báo giá
                  </small>
                  <b>{l.quote_count ?? 0} báo giá</b>
                </div>
                {l.deadline && (
                  <div className="m">
                    <small>
                      <svg className="ic"><use href="#ic-clock" /></svg> Hạn nhận báo giá
                    </small>
                    <b>{new Date(l.deadline).toLocaleDateString('vi-VN')}</b>
                  </div>
                )}
              </div>

              {/* Description */}
              {l.description && (
                <>
                  <h2 style={{ marginTop: 8 }}>Mô tả yêu cầu</h2>
                  <p className="prose" style={{ whiteSpace: 'pre-line' }}>{l.description}</p>
                </>
              )}
            </div>

            {/* Quote form */}
            <div className="card-block">
              <h2>Gửi báo giá của bạn</h2>
              <QuoteForm listingId={l.id} />
            </div>

            {/* Quote count hint */}
            {(l.quote_count ?? 0) > 0 && (
              <div className="card-block">
                <div className="between mb-16">
                  <h2 style={{ margin: 0 }}>Báo giá đã nhận ({l.quote_count})</h2>
                  <span className="muted">Chỉ chủ tin đăng nhìn thấy</span>
                </div>
                <div className="pill-note">
                  <svg className="ic"><use href="#ic-lock" /></svg>
                  <span>
                    Danh sách báo giá chỉ hiển thị với chủ doanh nghiệp đã đăng tin sau khi đăng nhập.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <aside>

            {/* Poster card */}
            {company ? (
              <div className="infobox" style={{ textAlign: 'center', position: 'sticky', top: 90 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    background: 'var(--navy)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 22,
                    margin: '0 auto 10px',
                  }}
                >
                  {ini}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
                  {company.name}
                </h3>
                {company.verified_tier !== 'none' && (
                  <span className="verify legal" style={{ margin: '0 auto 12px' }}>
                    <svg className="ic"><use href="#ic-shield-check" /></svg> Đã xác minh pháp lý
                  </span>
                )}
                <div
                  className="between"
                  style={{ fontSize: 13, margin: '12px 0', padding: 12, background: '#fafbfc', borderRadius: 10 }}
                >
                  <div>
                    <b style={{ color: 'var(--navy)', fontSize: 18 }}>{Math.round(company.trust_score)}</b>
                    <br />
                    <small className="muted">Trust Score</small>
                  </div>
                </div>
                <a className="btn btn-outline btn-block" href={`/cong-ty/${company.slug}`}>
                  Xem hồ sơ doanh nghiệp
                </a>
              </div>
            ) : (
              <div className="infobox" style={{ textAlign: 'center' }}>
                <p className="muted">Chủ đầu tư ẩn danh</p>
              </div>
            )}

            {/* Similar listings */}
            {similar.length > 0 && (
              <div className="infobox">
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>Tin tương tự</h3>
                {similar.map((s) => (
                  <a
                    key={s.id}
                    href={`/marketplace/${s.id}`}
                    className="row"
                    style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', display: 'flex' }}
                  >
                    <span className="badge gray" style={{ flexShrink: 0 }}>
                      {TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600, lineHeight: 1.3 }}>
                      {s.title}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
