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
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `Từ ${fmt(from)}`;
  return `Đến ${fmt(to!)}`;
}

function daysLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff < 0) return 'Đã hết hạn';
  if (diff === 0) return 'Hết hạn hôm nay';
  return `còn ${diff} ngày`;
}

async function getListing(id: string): Promise<(Listing & { companies?: { name: string; trust_score: number; verified_tier: string; slug: string; listing_count?: number } | null }) | null> {
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

// Mock quotes for demo (real: fetch from quotes table filtered by listing_id + is_owner)
const MOCK_QUOTES = [
  { initials: 'HB', bg: '#12439c', name: 'Xây dựng Hòa Bình', verified: true, rating: 4.9, amt: '52.000.000.000 ₫', time: '18 tháng', note: 'Hòa Bình có kinh nghiệm 35 năm thi công nhà cao tầng. Cam kết tiến độ và chất lượng.' },
  { initials: 'CT', bg: '#111', name: 'Coteccons', verified: true, rating: 4.8, amt: '49.000.000.000 ₫', time: '20 tháng', note: 'Coteccons đề xuất phương án tối ưu chi phí vật liệu với nhà cung cấp chiến lược.' },
  { initials: 'DL', bg: '#17479e', name: 'Delta Group', verified: false, rating: 4.5, amt: '55.500.000.000 ₫', time: '16 tháng', note: 'Delta tập trung tiến độ nhanh, đội ngũ 500 kỹ sư sẵn sàng triển khai ngay.' },
];

export default async function MarketplaceDetailPage({ params }: { params: { id: string } }) {
  const l = await getListing(params.id);
  if (!l) notFound();

  const similar = await getSimilar(params.id, l.type);
  const company = l.companies;
  const dl = daysLeft(l.deadline);
  const typeLabel = TYPE_LABEL[l.type] ?? l.type;
  const ini = company ? company.name.split(' ').slice(-2).map((w: string) => w[0]?.toUpperCase()).join('') : '??';
  const quoteCount = l.quote_count ?? 0;
  const showQuotes = quoteCount > 0;

  return (
    <>
      <style>{`
        .quote-item{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid var(--line-2)}
        .quote-item:last-child{border-bottom:none}
        .quote-item .qa{width:46px;height:46px;border-radius:11px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none;font-size:15px}
        .quote-item h4{font-size:14.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px}
        .quote-item .amt{font-size:16px;font-weight:800;color:var(--green);white-space:nowrap}
        .quote-item p{font-size:13px;color:#31414f;margin:5px 0 8px}
        .qactions{display:flex;gap:8px;flex-wrap:wrap}
        .att-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-2)}
        .att-row:last-child{border-bottom:none}
        .att-row .ic-b{width:38px;height:38px;border-radius:9px;background:var(--blue-soft);color:var(--blue);display:grid;place-items:center;flex:none}
        .att-row h4{font-size:13.5px;font-weight:600;color:var(--navy)}
        .att-row small{color:var(--muted);font-size:12px}
        .stars-row{display:inline-flex;align-items:center;gap:2px;font-size:13px}
        .stars-row .star{color:var(--orange)}
      `}</style>

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

          {/* MAIN */}
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

              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.3, marginBottom: 16 }}>
                {l.title}
              </h1>

              {/* Meta grid */}
              <div className="rfq-meta">
                <div className="m">
                  <small><svg className="ic"><use href="#ic-coin" /></svg> Ngân sách</small>
                  <b>{fmtBudget(l.budget_from, l.budget_to)}</b>
                </div>
                <div className="m">
                  <small><svg className="ic"><use href="#ic-pin" /></svg> Địa điểm</small>
                  <b>{l.location_text ?? 'Toàn quốc'}</b>
                </div>
                <div className="m">
                  <small><svg className="ic"><use href="#ic-calendar" /></svg> Khởi công</small>
                  <b>{l.start_date ?? 'Thương lượng'}</b>
                </div>
                {l.deadline && (
                  <div className="m">
                    <small><svg className="ic"><use href="#ic-clock" /></svg> Hạn nhận BG</small>
                    <b>{new Date(l.deadline).toLocaleDateString('vi-VN')}</b>
                  </div>
                )}
              </div>

              {/* View count */}
              <div className="row" style={{ gap: 16, fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                <span><svg className="ic" style={{ width: 14, height: 14 }}><use href="#ic-eye" /></svg> 342 lượt xem</span>
                <span><svg className="ic" style={{ width: 14, height: 14 }}><use href="#ic-file-text" /></svg> {quoteCount} báo giá đã nhận</span>
              </div>

              {/* Description */}
              {l.description && (
                <>
                  <h2 style={{ marginTop: 20, marginBottom: 10 }}>Mô tả yêu cầu</h2>
                  <div className="prose" style={{ whiteSpace: 'pre-line' }}>
                    {l.description}
                  </div>
                </>
              )}

              {/* Attachments */}
              <h2 style={{ marginTop: 20, marginBottom: 12 }}>Tài liệu đính kèm</h2>
              <div>
                <div className="att-row">
                  <span className="ic-b"><svg className="ic"><use href="#ic-file-text" /></svg></span>
                  <div>
                    <h4>Hồ sơ mời thầu.pdf</h4>
                    <small>PDF · 4.2 MB · Tải về</small>
                  </div>
                  <a className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>
                    <svg className="ic"><use href="#ic-download" /></svg>
                  </a>
                </div>
                <div className="att-row">
                  <span className="ic-b" style={{ background: '#eaf7ee', color: 'var(--green)' }}>
                    <svg className="ic"><use href="#ic-image" /></svg>
                  </span>
                  <div>
                    <h4>Phối cảnh dự án.jpg</h4>
                    <small>Hình ảnh · 1.8 MB</small>
                  </div>
                  <a className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>
                    <svg className="ic"><use href="#ic-download" /></svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Quote form */}
            <div className="card-block">
              <h2>Gửi báo giá của bạn</h2>
              <QuoteForm listingId={l.id} />
            </div>

            {/* Quotes received */}
            {showQuotes && (
              <div className="card-block">
                <div className="between mb-16">
                  <h2 style={{ margin: 0 }}>Báo giá đã nhận ({quoteCount})</h2>
                  <span className="muted" style={{ fontSize: 13 }}>Chỉ chủ tin nhìn thấy đầy đủ</span>
                </div>
                {MOCK_QUOTES.slice(0, Math.min(3, quoteCount > 0 ? 3 : 0)).map((q, i) => (
                  <div key={i} className="quote-item">
                    <span className="qa" style={{ background: q.bg }}>{q.initials}</span>
                    <div style={{ flex: 1 }}>
                      <h4>
                        {q.name}
                        {q.verified && <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>}
                        <span className="stars-row">
                          <span className="star">★</span> {q.rating}
                        </span>
                      </h4>
                      <div className="row" style={{ gap: 16, fontSize: 13, color: 'var(--muted)' }}>
                        <span className="amt">{q.amt}</span>
                        <span>· {q.time}</span>
                      </div>
                      <p>{q.note}</p>
                      <div className="qactions">
                        <a className="btn btn-navy btn-sm" href="/chat">
                          <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
                        </a>
                        <a className="btn btn-outline btn-sm">
                          <svg className="ic"><use href="#ic-check" /></svg> Shortlist
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
                {quoteCount <= 0 && (
                  <div className="pill-note">
                    <svg className="ic"><use href="#ic-lock" /></svg>
                    <span>Danh sách báo giá chỉ hiển thị với chủ doanh nghiệp đã đăng tin sau khi đăng nhập.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside>
            {/* Poster card */}
            {company ? (
              <div className="infobox" style={{ textAlign: 'center', position: 'sticky', top: 90 }}>
                <div
                  style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 22, margin: '0 auto 10px' }}
                >
                  {ini}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', marginBottom: 6 }}>
                  {company.name}
                </h3>
                {company.verified_tier !== 'none' && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <span className="verify legal">
                      <svg className="ic"><use href="#ic-shield-check" /></svg> Đã xác minh
                    </span>
                  </div>
                )}
                <div className="between" style={{ fontSize: 13, margin: '10px 0', padding: '10px 12px', background: '#fafbfc', borderRadius: 10 }}>
                  <div>
                    <b style={{ color: 'var(--navy)', fontSize: 18 }}>{Math.round(company.trust_score)}</b>
                    <br /><small className="muted">Trust Score</small>
                  </div>
                  <div>
                    <b style={{ color: 'var(--navy)', fontSize: 18 }}>12</b>
                    <br /><small className="muted">Tin đã đăng</small>
                  </div>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <a className="btn btn-navy btn-block" href="/chat">
                    <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
                  </a>
                  <a className="btn btn-outline btn-block" href={`/cong-ty/${company.slug}`}>
                    Xem hồ sơ doanh nghiệp
                  </a>
                </div>
              </div>
            ) : (
              <div className="infobox" style={{ textAlign: 'center' }}>
                <p className="muted">Chủ đầu tư ẩn danh</p>
                <a className="btn btn-navy btn-block mt-8" href="/chat">
                  <svg className="ic"><use href="#ic-chat" /></svg> Nhắn tin
                </a>
              </div>
            )}

            {/* Similar listings */}
            {similar.length > 0 && (
              <div className="infobox" style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 12, fontSize: 15 }}>
                  <svg className="ic"><use href="#ic-clipboard" /></svg> Tin tương tự
                </h3>
                {similar.map((s) => (
                  <a
                    key={s.id}
                    href={`/marketplace/${s.id}`}
                    className="row"
                    style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-2)', display: 'flex', textDecoration: 'none' }}
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
