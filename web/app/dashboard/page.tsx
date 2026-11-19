import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Bảng điều khiển' };
export const dynamic = 'force-dynamic';

const NAV_TRUST = [
  { href: '/dashboard/verify', icon: 'ic-shield', label: 'Xác minh' },
  { href: '/pricing', icon: 'ic-award', label: 'Gói thành viên' },
  { href: '#', icon: 'ic-users', label: 'Thành viên & phân quyền' },
  { href: '/dashboard/settings', icon: 'ic-settings', label: 'Cài đặt & quyền riêng tư' },
  { href: '/login/signout', icon: 'ic-logout', label: 'Đăng xuất' },
];

function initials(name: string) {
  return name.split(' ').filter((w) => w.length > 1).slice(-2).map((w) => w[0].toUpperCase()).join('');
}

const TIER_LABELS: Record<string, string> = {
  gold: 'Đối tác vàng',
  capability: 'Có chứng chỉ năng lực',
  legal: 'Đã xác minh pháp lý',
  none: 'Chưa xác minh',
};
const TIER_COLORS: Record<string, string> = {
  gold: '#c08a1a', capability: '#0d6b3f', legal: '#12439c', none: '#555',
};
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', editor: 'Editor', member: 'Thành viên',
};

async function getDashboardData() {
  const supa = createSupabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  // Công ty đầu tiên user là thành viên active
  const { data: membership } = await supa
    .from('company_members')
    .select('company_id, role, companies ( * )')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const company = (membership?.companies as unknown as Record<string, unknown> | null) ?? null;
  const role = membership?.role ?? null;

  if (!company) return { user, company: null, role: null, members: [], notifications: [], listings: [], trustScore: null, received: [], sent: [], stats: { openListings: 0, received: 0, sent: 0, unread: 0 } };

  const companyId = company.id as string;

  // Thành viên
  const { data: members } = await supa
    .from('company_members')
    .select('*, profiles ( full_name, avatar_url )')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('created_at');

  // Thông báo chưa đọc (gần nhất)
  const { data: notifications } = await supa
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(5);

  // Tin đăng của công ty
  const { data: listings } = await supa
    .from('marketplace_listings')
    .select('id, title, type, status, quote_count, created_at')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // Trust Score
  const { data: trustScore } = await supa
    .from('trust_scores')
    .select('score, breakdown')
    .eq('company_id', companyId)
    .maybeSingle();

  // Báo giá nhận được trên tin của công ty
  const { data: received } = await supa
    .from('quotes')
    .select('id, amount, status, created_at, company:companies ( name, slug ), listing:marketplace_listings!inner ( id, title, company_id )')
    .eq('listing.company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Báo giá công ty đã gửi
  const { data: sent } = await supa
    .from('quotes')
    .select('id, amount, status, created_at, listing:marketplace_listings ( id, title )')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Số liệu thống kê (count only)
  const head = { count: 'exact' as const, head: true };
  const [openL, recvN, sentN, unreadN] = await Promise.all([
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

const TYPE_LABEL: Record<string, string> = {
  need_contractor: 'Tìm nhà thầu',
  need_crew: 'Tìm đội thi công',
  need_supplier: 'Tìm nhà cung cấp',
  partnership: 'Hợp tác',
  offer_service: 'Cung cấp dịch vụ',
  opportunity: 'Cơ hội',
};
const STATUS_CLS: Record<string, string> = {
  open: 'green', closed: 'gray', fulfilled: 'blue', expired: 'gray',
};
const STATUS_LBL: Record<string, string> = {
  open: 'Đang mở', closed: 'Đã đóng', fulfilled: 'Hoàn tất', expired: 'Hết hạn',
};
const QUOTE_LBL: Record<string, string> = {
  sent: 'Đã gửi', shortlisted: 'Danh sách rút gọn', accepted: 'Được chọn', rejected: 'Từ chối', withdrawn: 'Đã rút',
};
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
  const slug = co.slug as string;
  const coName = co.name as string;
  const tier = (co.verified_tier as string) ?? 'none';
  const trust = Math.round((trustScore?.score ?? (co.trust_score as number) ?? 0));
  const completeness = (co.profile_completeness as number) ?? 0;
  const ini = initials(coName);
  const logoColor = TIER_COLORS[tier] ?? '#12439c';

  const NAV_ITEMS = [
    { href: '/dashboard', icon: 'ic-chart', label: 'Tổng quan', active: true },
    { href: `/cong-ty/${slug}`, icon: 'ic-building', label: 'Hồ sơ công khai' },
    { href: '/dashboard/company-edit', icon: 'ic-edit', label: 'Chỉnh sửa hồ sơ' },
  ];
  const NAV_BIZ = [
    { href: '/marketplace', icon: 'ic-briefcase', label: 'Tin đăng của tôi' },
    { href: '#quotes', icon: 'ic-file-text', label: 'Báo giá', badge: stats.received || undefined },
    { href: '/chat', icon: 'ic-chat', label: 'Tin nhắn', badge: notifications.filter((n: Record<string, unknown>) => n.type === 'new_message').length || undefined },
    { href: '/feed', icon: 'ic-layers', label: 'Bài viết' },
  ];

  return (
    <div className="dash">
      <style>{`
        .dash{display:grid;grid-template-columns:250px 1fr;gap:0;align-items:start}
        .dside{background:#fff;border-right:1px solid var(--line);min-height:calc(100vh - 66px);padding:20px 14px;position:sticky;top:66px}
        .dside .co{display:flex;gap:10px;align-items:center;padding:10px;border-radius:10px;background:#fafbfc;margin-bottom:16px}
        .dside .co .a{width:40px;height:40px;border-radius:10px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none}
        .dside .co h4{font-size:13.5px;font-weight:700;color:var(--navy)}
        .dside .co small{font-size:11px;color:var(--green);display:flex;align-items:center;gap:3px}
        .dnav a{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:9px;font-size:14px;font-weight:600;color:var(--text);margin-bottom:2px;text-decoration:none}
        .dnav a svg{width:18px;height:18px;color:var(--muted)}
        .dnav a.active{background:var(--navy);color:#fff}
        .dnav a.active svg{color:var(--orange-2)}
        .dnav a:hover:not(.active){background:#f6f8fb}
        .dnav .grp{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:16px 12px 8px;font-weight:700}
        .dnav .dbadge{background:var(--orange);color:#fff;font-size:11px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;padding:0 5px;margin-left:auto}
        .dmain{padding:26px}
        .welcome{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap}
        .welcome h1{font-size:23px;font-weight:800;color:var(--navy)}
        .welcome p{color:var(--muted);font-size:14px;margin-top:3px}
        .dcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;box-shadow:var(--shadow-sm)}
        .dcard h3{font-size:15px;font-weight:700;color:var(--navy);margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
        .act-row{display:flex;gap:12px;padding:11px 0;border-bottom:1px solid var(--line-2);font-size:13.5px;align-items:center}
        .act-row:last-child{border-bottom:none}
        .act-row .ic-b{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
        .act-row small{color:var(--muted);font-size:12px;margin-left:auto;white-space:nowrap}
        .todo{display:flex;align-items:center;gap:10px;padding:10px 0;font-size:13.5px;border-bottom:1px solid var(--line-2)}
        .todo:last-child{border-bottom:none}
        .todo .ck{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--line);display:grid;place-items:center;flex:none}
        .todo.done .ck{background:var(--green);border-color:var(--green);color:#fff}
        .todo.done span{color:var(--muted);text-decoration:line-through}
        .todo a{margin-left:auto;color:var(--orange);font-weight:600;font-size:12.5px;text-decoration:none}
        .stat-tile .ic-b{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;margin-bottom:8px}
        .table{width:100%;border-collapse:collapse;font-size:13.5px}
        .table th{text-align:left;padding:8px 12px;color:var(--muted);font-weight:600;font-size:12.5px;border-bottom:1px solid var(--line)}
        .table td{padding:10px 12px;border-bottom:1px solid var(--line-2)}
        .table tr:last-child td{border-bottom:none}
        @media(max-width:900px){.dash{grid-template-columns:1fr}.dside{position:static;min-height:auto;border-right:none;border-bottom:1px solid var(--line)}.dnav{display:flex;flex-wrap:wrap;gap:4px}.dnav a{margin:0}.dnav .grp{width:100%}}
      `}</style>

      {/* SIDEBAR */}
      <aside className="dside">
        <div className="co">
          {co.logo_url ? (
            <img src={co.logo_url as string} alt={coName} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
          ) : (
            <span className="a" style={{ background: logoColor }}>{ini}</span>
          )}
          <div>
            <h4>{coName}</h4>
            <small>
              <svg className="ic"><use href="#ic-shield-check" /></svg>
              {TIER_LABELS[tier] ?? 'Chưa xác minh'}
            </small>
          </div>
        </div>
        <nav className="dnav">
          {NAV_ITEMS.map((n) => (
            <a key={n.label} href={n.href} className={n.active ? 'active' : ''}>
              <svg className="ic"><use href={`#${n.icon}`} /></svg> {n.label}
            </a>
          ))}
          <div className="grp">Kinh doanh</div>
          {NAV_BIZ.map((n) => (
            <a key={n.label} href={n.href}>
              <svg className="ic"><use href={`#${n.icon}`} /></svg> {n.label}
              {n.badge ? <span className="dbadge">{n.badge}</span> : null}
            </a>
          ))}
          <div className="grp">Uy tín &amp; tài khoản</div>
          {NAV_TRUST.map((n) => (
            <a key={n.label} href={n.href}>
              <svg className="ic"><use href={`#${n.icon}`} /></svg> {n.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="dmain">
        <div className="welcome">
          <div>
            <h1>Xin chào, {coName} 👋</h1>
            <p>Đây là tổng quan hoạt động doanh nghiệp của bạn trên nền tảng.</p>
          </div>
          <div className="row">
            <a className="btn btn-outline" href="/marketplace">
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
                  <a href="/marketplace" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>Quản lý</a>
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
                          <span className={`badge ${STATUS_CLS[l.status as string] ?? 'gray'}`}>
                            {STATUS_LBL[l.status as string] ?? l.status as string}
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
                <a className="btn btn-orange" href="/marketplace">
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
                <a className="btn btn-outline btn-block btn-sm mt-8">
                  <svg className="ic"><use href="#ic-plus" /></svg> Mời thành viên
                </a>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
