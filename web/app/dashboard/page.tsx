import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUserCompany } from '@/lib/supabase/company';
import { TIER_COLORS, ROLE_LABELS, LISTING_TYPE_LABEL, LISTING_STATUS, QUOTE_STATUS } from '@/lib/format';
import { initials } from '@/lib/ui';

export const metadata: Metadata = { title: 'Bảng điều khiển' };
export const dynamic = 'force-dynamic';

const TYPE_LABEL = LISTING_TYPE_LABEL;
const QUOTE_LBL: Record<string, string> = Object.fromEntries(Object.entries(QUOTE_STATUS).map(([k, v]) => [k, v.label]));

async function getDashboardData() {
  const { supa, user, company, role } = await requireUserCompany('/dashboard');

  if (!company) return { user, company: null, role: null, members: [], notifications: [], listings: [], trustScore: null, received: [], sent: [], stats: { openListings: 0, received: 0, sent: 0, unread: 0 } };

  const companyId = company.id as string;

  // Mọi truy vấn độc lập → chạy song song (trước đây chạy lần lượt ~10 vòng gọi DB)
  const head = { count: 'exact' as const, head: true };
  const [
    { data: members },
    { data: notifications },
    { data: listings },
    { data: trustScore },
    { data: received },
    { data: sent },
    openL, recvN, sentN, unreadN,
  ] = await Promise.all([
    supa.from('company_members').select('*, profiles ( full_name, avatar_url )').eq('company_id', companyId).eq('status', 'active').order('created_at'),
    supa.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
    supa.from('marketplace_listings').select('id, title, type, status, quote_count, created_at').eq('company_id', companyId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    supa.from('trust_scores').select('score, breakdown').eq('company_id', companyId).maybeSingle(),
    supa.from('quotes').select('id, amount, status, created_at, company:companies ( name, slug ), listing:marketplace_listings!inner ( id, title, company_id )').eq('listing.company_id', companyId).order('created_at', { ascending: false }).limit(5),
    supa.from('quotes').select('id, amount, status, created_at, listing:marketplace_listings ( id, title )').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
    supa.from('marketplace_listings').select('id', head).eq('company_id', companyId).eq('status', 'open').is('deleted_at', null),
    supa.from('quotes').select('id, listing:marketplace_listings!inner(company_id)', head).eq('listing.company_id', companyId),
    supa.from('quotes').select('id', head).eq('company_id', companyId),
    supa.from('notifications').select('id', head).eq('user_id', user.id).eq('is_read', false),
  ]);
  const stats = {
    openListings: openL.count ?? 0, received: recvN.count ?? 0, sent: sentN.count ?? 0, unread: unreadN.count ?? 0,
  };

  return { user, company, role, members: members ?? [], notifications: notifications ?? [], listings: listings ?? [], trustScore, received: received ?? [], sent: sent ?? [], stats };
}

const NOTIF_ICONS: Record<string, string> = {
  new_message: 'ic-chat',
  new_quote: 'ic-file-text',
  review_received: 'ic-star-f',
  verify_result: 'ic-shield-check',
  connection_request: 'ic-people',
};
const NOTIF_COLORS: Record<string, string> = {
  new_message: 'var(--blue)',
  new_quote: 'var(--orange)',
  review_received: 'var(--green)',
  verify_result: 'var(--green)',
  connection_request: 'var(--navy)',
};

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) redirect('/login');

  const { company, role, members, notifications, listings, trustScore, received, sent, stats } = data;

  // Nếu chưa có công ty → hiển thị trang onboarding
  if (!company) {
    // Có hồ sơ khớp email Google → đưa thẳng tới trang nhận hồ sơ
    const { data: claimable } = await createSupabaseServer().rpc('my_claimable_companies');
    if ((claimable ?? []).length > 0) redirect('/dashboard/claim');
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <svg className="ic" style={{ width: 64, height: 64, color: 'var(--navy)', opacity: 0.2, marginBottom: 20 }}><use href="#ic-building" /></svg>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>Chưa có công ty nào</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
          Bạn chưa thuộc doanh nghiệp nào trên sàn. Tạo mới hoặc nhận hồ sơ công ty theo số điện thoại/MST.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <a className="btn btn-orange" href="/dashboard/new">
            <svg className="ic"><use href="#ic-plus" /></svg> Tạo công ty mới
          </a>
          <a className="btn btn-outline" href="/dashboard/claim">
            <svg className="ic"><use href="#ic-search" /></svg> Tìm & nhận hồ sơ
          </a>
        </div>
      </div>
    );
  }

  const co = company as Record<string, unknown>;
  const coName = co.name as string;
  const tier = (co.verified_tier as string) ?? 'none';
  const trust = Math.round((trustScore?.score ?? (co.trust_score as number) ?? 0));
  const completeness = (co.profile_completeness as number) ?? 0;

  return (
    <>


      {/* MAIN */}
      <div className="dpage">
        <div className="welcome">
          <div>
            <h1>Xin chào, {coName} 👋</h1>
            <p>Đây là tổng quan hoạt động doanh nghiệp của bạn trên nền tảng.</p>
          </div>
          <div className="row">
            <a className="btn btn-outline" href="/marketplace/new">
              <svg className="ic"><use href="#ic-plus" /></svg> Đăng nhu cầu
            </a>
            <a className="btn btn-orange" href="/feed">
              <svg className="ic"><use href="#ic-edit" /></svg> Đăng bài
            </a>
          </div>
        </div>

        {/* Thống kê */}
        <div className="grid-4 mb-24" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 16 }}>
          {[
            { icon: 'ic-briefcase', label: 'Tin đang mở', val: stats.openListings, color: 'var(--blue)' },
            { icon: 'ic-file-text', label: 'Báo giá nhận được', val: stats.received, color: 'var(--orange)' },
            { icon: 'ic-trending', label: 'Báo giá đã gửi', val: stats.sent, color: 'var(--green)' },
            { icon: 'ic-bell', label: 'Thông báo chưa đọc', val: stats.unread, color: 'var(--navy)' },
          ].map((t) => (
            <div key={t.label} className="dcard stat-tile">
              <span className="ic-b" style={{ background: `${t.color}22`, color: t.color }}><svg className="ic"><use href={`#${t.icon}`} /></svg></span>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)' }}>{t.val}</div>
              <small className="muted">{t.label}</small>
            </div>
          ))}
        </div>

        {/* Trust + completeness */}
        <div className="grid-2 mb-24" style={{ gap: 20 }}>
          <div className="dcard" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="trust-ring" style={{ ['--val' as never]: trust }}>
              <div className="inner"><b>{trust}</b><small>/100</small></div>
            </div>
            <div>
              <h3 style={{ marginBottom: 6 }}>Trust Score</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                {trust >= 80
                  ? <>Top doanh nghiệp uy tín.<br />Tiếp tục duy trì chất lượng.</>
                  : trust >= 50
                    ? <>Đang tiến bộ tốt.<br />Xác minh &amp; thêm dự án để tăng điểm.</>
                    : <>Hồ sơ mới.<br />Hoàn thiện để tăng cơ hội nhận báo giá.</>}
              </p>
              <a href="/dashboard/verify" style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 12.5 }}>
                Cách nâng điểm →
              </a>
            </div>
          </div>
          <div className="dcard">
            <h3>Độ hoàn thiện hồ sơ <b style={{ color: 'var(--orange)' }}>{completeness}%</b></h3>
            <div className="progress mb-16"><div className="bar" style={{ width: `${completeness}%` }} /></div>
            <div className={`todo ${co.name ? 'done' : ''}`}>
              <span className="ck">
                {co.name ? <svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg> : null}
              </span>
              <span>Thông tin cơ bản &amp; logo</span>
              {!co.logo_url && <a href="/dashboard/company-edit">Thêm</a>}
            </div>
            <div className={`todo ${tier !== 'none' ? 'done' : ''}`}>
              <span className="ck">
                {tier !== 'none' ? <svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg> : null}
              </span>
              <span>Xác minh pháp lý</span>
              {tier === 'none' && <a href="/dashboard/verify">Xác minh</a>}
            </div>
            <div className={`todo ${co.website ? 'done' : ''}`}>
              <span className="ck">
                {co.website ? <svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg> : null}
              </span>
              <span>Website &amp; mô tả công ty</span>
              {!co.website && <a href="/dashboard/company-edit">Thêm</a>}
            </div>
          </div>
        </div>

        <div className="grid-side-r" style={{ gap: 20 }}>
          <div>
            {/* Tin đăng của tôi */}
            {listings.length > 0 && (
              <div className="dcard mb-24">
                <h3>
                  Tin đăng của tôi{' '}
                  <a href="/dashboard/listings" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>Quản lý</a>
                </h3>
                <table className="table">
                  <thead>
                    <tr><th>Tiêu đề</th><th>Loại</th><th>Báo giá</th><th>Trạng thái</th></tr>
                  </thead>
                  <tbody>
                    {(listings as Record<string, unknown>[]).map((l) => (
                      <tr key={l.id as string}>
                        <td><a href={`/marketplace/${l.id as string}`}><b style={{ color: 'var(--navy)' }}>{l.title as string}</b></a></td>
                        <td>{TYPE_LABEL[l.type as string] ?? l.type as string}</td>
                        <td>{l.quote_count as number}</td>
                        <td>
                          <span className={`badge ${LISTING_STATUS[l.status as string]?.cls ?? 'gray'}`}>
                            {LISTING_STATUS[l.status as string]?.label ?? (l.status as string)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {listings.length === 0 && (
              <div className="dcard mb-24" style={{ textAlign: 'center', padding: 32 }}>
                <svg className="ic" style={{ width: 40, height: 40, color: 'var(--muted)', opacity: 0.3, marginBottom: 12 }}><use href="#ic-briefcase" /></svg>
                <p className="muted" style={{ marginBottom: 16 }}>Chưa có tin đăng nào.</p>
                <a className="btn btn-orange" href="/marketplace/new">
                  <svg className="ic"><use href="#ic-plus" /></svg> Đăng tin mới
                </a>
              </div>
            )}

            {/* Báo giá */}
            <div className="dcard mb-24" id="quotes">
              <h3>Báo giá nhận được</h3>
              {(received as Record<string, any>[]).length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Chưa có báo giá nào cho tin đăng của bạn.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Tin đăng</th><th>Từ</th><th>Giá</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {(received as Record<string, any>[]).map((q) => (
                      <tr key={q.id}>
                        <td><a href={`/marketplace/${q.listing?.id}`}><b style={{ color: 'var(--navy)' }}>{q.listing?.title}</b></a></td>
                        <td>{q.company?.slug ? <a href={`/cong-ty/${q.company.slug}`}>{q.company.name}</a> : '—'}</td>
                        <td>{q.amount != null ? `${Number(q.amount).toLocaleString('vi-VN')}₫` : 'Thương lượng'}</td>
                        <td><span className="badge gray">{QUOTE_LBL[q.status] ?? q.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(sent as Record<string, any>[]).length > 0 && (
                <>
                  <h3 style={{ marginTop: 22 }}>Báo giá đã gửi</h3>
                  <table className="table">
                    <thead><tr><th>Tin đăng</th><th>Giá</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                      {(sent as Record<string, any>[]).map((q) => (
                        <tr key={q.id}>
                          <td><a href={`/marketplace/${q.listing?.id}`}>{q.listing?.title}</a></td>
                          <td>{q.amount != null ? `${Number(q.amount).toLocaleString('vi-VN')}₫` : '—'}</td>
                          <td><span className="badge gray">{QUOTE_LBL[q.status] ?? q.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          {/* Right column */}
          <aside>
            {/* Thông báo */}
            <div className="dcard mb-24">
              <h3>
                <svg className="ic" style={{ width: 18, height: 18, color: 'var(--orange)' }}><use href="#ic-bell" /></svg>
                {' '}Thông báo {notifications.length > 0 && <span className="dbadge" style={{ fontSize: 12 }}>{notifications.length}</span>}
              </h3>
              {notifications.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Không có thông báo mới.</p>
              ) : (
                (notifications as Record<string, unknown>[]).map((n) => {
                  const icon = NOTIF_ICONS[n.type as string] ?? 'ic-bell';
                  const color = NOTIF_COLORS[n.type as string] ?? 'var(--navy)';
                  return (
                    <div key={n.id as string} className="act-row" style={{ padding: '9px 0' }}>
                      <span className="ic-b" style={{ background: `${color}22`, color }}>
                        <svg className="ic"><use href={`#${icon}`} /></svg>
                      </span>
                      <a href={(n.link as string) || '#'} style={{ fontSize: 13, color: 'inherit', textDecoration: 'none' }}>{(n.title as string) ?? (n.body as string)}</a>
                    </div>
                  );
                })
              )}
            </div>

            {/* Thành viên */}
            <div className="dcard">
              <h3>Thành viên ({members.length})</h3>
              {(members as Record<string, unknown>[]).slice(0, 5).map((m) => {
                const profile = m.profiles as Record<string, unknown> | null;
                const mName = (profile?.full_name as string) ?? 'Thành viên';
                const mIni = initials(mName);
                return (
                  <div key={m.id as string} className="act-row" style={{ padding: '8px 0' }}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url as string} alt={mName} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 34, height: 34, borderRadius: '50%', background: TIER_COLORS[tier], display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{mIni}</span>
                    )}
                    <span style={{ fontSize: 13, flex: 1 }}>{mName}</span>
                    <small>{ROLE_LABELS[m.role as string] ?? m.role as string}</small>
                  </div>
                );
              })}
              {(role === 'owner' || role === 'admin') && (
                <a className="btn btn-outline btn-block btn-sm mt-8" href="/dashboard/members">
                  <svg className="ic"><use href="#ic-plus" /></svg> Mời thành viên
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
