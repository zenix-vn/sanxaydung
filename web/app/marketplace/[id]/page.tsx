import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { SUPABASE_URL } from '@/lib/env';
import type { Listing } from '@/lib/types';
import QuoteForm from './QuoteForm';
import QuoteActions from './QuoteActions';
import { getMe } from '@/lib/me';
import { colorFor, initials, fmtMoney } from '@/lib/ui';

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

interface QuoteRow {
  id: string;
  company_id: string;
  amount: number | null;
  message: string | null;
  status: string;
  created_at: string;
  companies: { id: string; name: string; slug: string; logo_url: string | null; verified_tier: string; trust_score: number } | null;
}

// RLS: chủ tin thấy mọi báo giá; bên báo giá chỉ thấy báo giá của mình; người khác thấy rỗng.
async function getQuotes(listingId: string): Promise<QuoteRow[]> {
  if (!SUPABASE_URL) return [];
  try {
    const supa = createSupabaseServer();
    const { data } = await supa
      .from('quotes')
      .select('id, company_id, amount, message, status, created_at, companies ( id, name, slug, logo_url, verified_tier, trust_score )')
      .eq('listing_id', listingId)
      .neq('status', 'withdrawn')
      .order('amount', { ascending: true, nullsFirst: false });
    return (data ?? []) as unknown as QuoteRow[];
  } catch {
    return [];
  }
}

async function countOpenListings(companyId: string): Promise<number> {
  if (!SUPABASE_URL) return 0;
  try {
    const { count } = await createSupabaseServer()
      .from('marketplace_listings')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'open')
      .is('deleted_at', null);
    return count ?? 0;
  } catch {
    return 0;
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

  const [similar, quotes, me, listingCount] = await Promise.all([
    getSimilar(params.id, l.type),
    getQuotes(params.id),
    getMe(),
    countOpenListings(l.company_id),
  ]);
  const isOwner = me.companies.some((c) => c.id === l.company_id);
  const chatHref = `/chat?to=${l.company_id}&listing=${l.id}`;
  const company = l.companies;
  const dl = daysLeft(l.deadline);
  const typeLabel = TYPE_LABEL[l.type] ?? l.type;
  const ini = company ? company.name.split(' ').slice(-2).map((w: string) => w[0]?.toUpperCase()).join('') : '??';
  const quoteCount = l.quote_count ?? 0;
  const showQuotes = quotes.length > 0;

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

            </div>

            {/* Quote form */}
            {l.status === 'open' ? (
              <div className="card-block">
                <h2>Gửi báo giá của bạn</h2>
                <QuoteForm listingId={l.id} ownerCompanyId={l.company_id} />
              </div>
            ) : (
              <div className="card-block"><p className="muted">Tin này đã đóng nhận báo giá.</p></div>
            )}

            {/* Quotes received */}
            {showQuotes && (
              <div className="card-block">
                <div className="between mb-16">
                  <h2 style={{ margin: 0 }}>{isOwner ? `Báo giá đã nhận (${quotes.length})` : 'Báo giá của bạn'}</h2>
                  {isOwner && <span className="muted" style={{ fontSize: 13 }}>Chỉ chủ tin nhìn thấy đầy đủ</span>}
                </div>
                {quotes.map((q) => {
                  const co = q.companies;
                  const name = co?.name ?? 'Doanh nghiệp';
                  return (
                    <div key={q.id} className="quote-item">
                      {co?.logo_url ? (
                        <img src={co.logo_url} alt={name} className="qa" style={{ objectFit: 'cover' }} />
                      ) : (
                        <span className="qa" style={{ background: colorFor(co?.id ?? name) }}>{initials(name)}</span>
                      )}
                      <div style={{ flex: 1 }}>
                        <h4>
                          <a href={co ? `/cong-ty/${co.slug}` : '#'} style={{ color: 'inherit', textDecoration: 'none' }}>{name}</a>
                          {co && co.verified_tier !== 'none' && <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>}
                          {co && <span className="stars-row">Trust {Math.round(co.trust_score ?? 0)}</span>}
                        </h4>
                        <div className="row" style={{ gap: 16, fontSize: 13, color: 'var(--muted)' }}>
                          <span className="amt">{q.amount != null ? `${q.amount.toLocaleString('vi-VN')} ₫` : 'Thương lượng'}</span>
                          {q.amount != null && <span>· {fmtMoney(q.amount)}</span>}
                        </div>
                        {q.message && <p style={{ whiteSpace: 'pre-line' }}>{q.message}</p>}
                        {isOwner ? (
                          <QuoteActions quoteId={q.id} status={q.status} chatHref={`/chat?to=${q.company_id}&listing=${l.id}`} />
                        ) : (
                          <span className="badge gray">{q.status === 'sent' ? 'Đã gửi' : q.status}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                    <b style={{ color: 'var(--navy)', fontSize: 18 }}>{listingCount}</b>
                    <br /><small className="muted">Tin đang mở</small>
                  </div>
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <a className="btn btn-navy btn-block" href={chatHref}>
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
                <a className="btn btn-navy btn-block mt-8" href={chatHref}>
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
