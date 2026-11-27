import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import { canEdit } from '@/lib/roles';
import { LISTING_TYPE_LABEL, LISTING_STATUS, QUOTE_STATUS, fmtDate, daysLeft } from '@/lib/format';
import { fmtMoney } from '@/lib/ui';
import { ListingActions, WithdrawQuote } from './ListingActions';

export const metadata: Metadata = { title: 'Tin đăng & báo giá' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'open', label: 'Đang mở' },
  { key: 'fulfilled', label: 'Hoàn tất' },
  { key: 'closed', label: 'Đã đóng' },
  { key: 'expired', label: 'Hết hạn' },
];

type L = { id: string; title: string; type: string; status: string; deadline: string | null; quote_count: number | null; created_at: string };
type Q = { id: string; listing_id: string; status: string };
type Sent = { id: string; amount: number | null; status: string; created_at: string; listing: { id: string; title: string; status: string; companies: { name: string; slug: string } | null } | null };

export default async function MyListingsPage({ searchParams }: { searchParams: { status?: string; view?: string } }) {
  const { supa, company, role } = await requireUserCompany('/dashboard/listings');
  if (!company) return null;
  const status = TABS.some((t) => t.key === searchParams.status) ? searchParams.status ?? '' : '';
  const view = searchParams.view === 'sent' ? 'sent' : 'mine';
  const editor = canEdit({ role: role ?? 'member' });

  const [{ data: all }, { data: sentRaw }] = await Promise.all([
    supa
      .from('marketplace_listings')
      .select('id, title, type, status, deadline, quote_count, created_at')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supa
      .from('quotes')
      .select('id, amount, status, created_at, listing:marketplace_listings ( id, title, status, companies ( name, slug ) )')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  const listings = (all ?? []) as L[];
  const sent = (sentRaw ?? []) as unknown as Sent[];
  const shown = status ? listings.filter((l) => l.status === status) : listings;
  const countBy = (k: string) => (k ? listings.filter((l) => l.status === k).length : listings.length);

  // Báo giá chưa xử lý trên mỗi tin
  let fresh = new Map<string, number>();
  if (listings.length) {
    const { data } = await supa.from('quotes').select('id, listing_id, status').in('listing_id', listings.map((l) => l.id)).eq('status', 'sent');
    fresh = ((data ?? []) as Q[]).reduce((m, q) => m.set(q.listing_id, (m.get(q.listing_id) ?? 0) + 1), new Map<string, number>());
  }

  return (
    <div>
      <div className="dpage-head">
        <div>
          <h1>Tin đăng &amp; báo giá</h1>
          <p>Quản lý nhu cầu đã đăng, so sánh báo giá nhận được và theo dõi báo giá bạn đã gửi.</p>
        </div>
        {editor && (
          <a className="btn btn-orange" href="/marketplace/new">
            <svg className="ic"><use href="#ic-plus" /></svg> Đăng nhu cầu
          </a>
        )}
      </div>

      <div className="dtabs" style={{ marginBottom: 20 }}>
        <a className={view === 'mine' ? 'active' : ''} href="/dashboard/listings">Tin của tôi <span className="n">{listings.length}</span></a>
        <a className={view === 'sent' ? 'active' : ''} href="/dashboard/listings?view=sent">Báo giá đã gửi <span className="n">{sent.length}</span></a>
      </div>

      {view === 'mine' ? (
        <div className="dcard">
          <div className="dtabs">
            {TABS.map((t) => (
              <a key={t.key} className={status === t.key ? 'active' : ''} href={`/dashboard/listings${t.key ? `?status=${t.key}` : ''}`}>
                {t.label} <span className="n">{countBy(t.key)}</span>
              </a>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="empty">
              <svg className="ic"><use href="#ic-briefcase" /></svg>
              {listings.length ? 'Không có tin nào ở trạng thái này.' : 'Bạn chưa đăng tin nào. Đăng nhu cầu để nhận báo giá từ các đối tác phù hợp.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Tin đăng</th><th>Hạn</th><th>Báo giá</th><th>Trạng thái</th>{editor && <th style={{ textAlign: 'right' }}>Thao tác</th>}</tr>
                </thead>
                <tbody>
                  {shown.map((l) => {
                    const st = LISTING_STATUS[l.status];
                    const dl = l.status === 'open' ? daysLeft(l.deadline) : null;
                    const n = fresh.get(l.id) ?? 0;
                    return (
                      <tr key={l.id}>
                        <td>
                          <a href={`/marketplace/${l.id}`}><b style={{ color: 'var(--navy)' }}>{l.title}</b></a>
                          <div className="muted" style={{ fontSize: 12 }}>{LISTING_TYPE_LABEL[l.type] ?? l.type} · đăng {fmtDate(l.created_at)}</div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {fmtDate(l.deadline)}
                          {dl && <div style={{ fontSize: 12, color: dl.urgent ? 'var(--orange)' : 'var(--muted)' }}>{dl.label}</div>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <a href={`/marketplace/${l.id}#quotes`}>{l.quote_count ?? 0}</a>
                          {n > 0 && <span className="badge orange" style={{ marginLeft: 6 }}>{n} mới</span>}
                        </td>
                        <td><span className={`badge ${st?.cls ?? 'gray'}`}>{st?.label ?? l.status}</span></td>
                        {editor && <td><ListingActions id={l.id} status={l.status} deadline={l.deadline} /></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="dcard">
          {sent.length === 0 ? (
            <div className="empty">
              <svg className="ic"><use href="#ic-file-text" /></svg>
              Bạn chưa gửi báo giá nào. <a href="/marketplace">Xem nhu cầu đang mở →</a>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Tin đăng</th><th>Giá đề xuất</th><th>Ngày gửi</th><th>Trạng thái</th>{editor && <th />}</tr></thead>
                <tbody>
                  {sent.map((q) => {
                    const st = QUOTE_STATUS[q.status];
                    return (
                      <tr key={q.id}>
                        <td>
                          {q.listing ? <a href={`/marketplace/${q.listing.id}`}><b style={{ color: 'var(--navy)' }}>{q.listing.title}</b></a> : '—'}
                          {q.listing?.companies && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              của <a href={`/cong-ty/${q.listing.companies.slug}`}>{q.listing.companies.name}</a>
                            </div>
                          )}
                        </td>
                        <td>{q.amount != null ? `${fmtMoney(q.amount)} ₫` : 'Thương lượng'}</td>
                        <td>{fmtDate(q.created_at)}</td>
                        <td><span className={`badge ${st?.cls ?? 'gray'}`}>{st?.label ?? q.status}</span></td>
                        {editor && <td style={{ textAlign: 'right' }}>{['sent', 'shortlisted'].includes(q.status) && <WithdrawQuote id={q.id} />}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
