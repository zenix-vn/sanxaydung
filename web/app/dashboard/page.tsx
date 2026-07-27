import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Bảng điều khiển' };

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'ic-chart', label: 'Tổng quan', active: true },
  { href: '/cong-ty/hoa-binh', icon: 'ic-building', label: 'Hồ sơ công khai' },
  { href: '/dashboard/company-edit', icon: 'ic-edit', label: 'Chỉnh sửa hồ sơ' },
];
const NAV_BIZ = [
  { href: '/marketplace', icon: 'ic-briefcase', label: 'Tin đăng của tôi' },
  { href: '/marketplace', icon: 'ic-file-text', label: 'Báo giá', badge: '5' },
  { href: '/chat', icon: 'ic-chat', label: 'Tin nhắn', badge: '3' },
  { href: '/feed', icon: 'ic-layers', label: 'Bài viết' },
];
const NAV_TRUST = [
  { href: '/dashboard/verify', icon: 'ic-shield', label: 'Xác minh' },
  { href: '/pricing', icon: 'ic-award', label: 'Gói thành viên' },
  { href: '#', icon: 'ic-users', label: 'Thành viên & phân quyền' },
  { href: '#', icon: 'ic-settings', label: 'Cài đặt' },
  { href: '/', icon: 'ic-logout', label: 'Đăng xuất' },
];

export default function DashboardPage() {
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
        .delta{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--green);margin-top:4px}
        .table{width:100%;border-collapse:collapse;font-size:13.5px}
        .table th{text-align:left;padding:8px 12px;color:var(--muted);font-weight:600;font-size:12.5px;border-bottom:1px solid var(--line)}
        .table td{padding:10px 12px;border-bottom:1px solid var(--line-2)}
        .table tr:last-child td{border-bottom:none}
        @media(max-width:900px){.dash{grid-template-columns:1fr}.dside{position:static;min-height:auto;border-right:none;border-bottom:1px solid var(--line)}.dnav{display:flex;flex-wrap:wrap;gap:4px}.dnav a{margin:0}.dnav .grp{width:100%}}
      `}</style>

      {/* SIDEBAR */}
      <aside className="dside">
        <div className="co">
          <span className="a" style={{ background: '#12439c' }}>HB</span>
          <div>
            <h4>Xây dựng Hòa Bình</h4>
            <small>
              <svg className="ic"><use href="#ic-shield-check" /></svg> Đối tác vàng
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
              {n.badge && <span className="dbadge">{n.badge}</span>}
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
            <h1>Xin chào, Hòa Bình 👋</h1>
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

        {/* Stats */}
        <div className="grid-4 mb-24">
          <div className="stat-tile">
            <div className="ic-b" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <svg className="ic"><use href="#ic-eye" /></svg>
            </div>
            <div className="num">3.842</div>
            <div className="lbl">Lượt xem hồ sơ (30 ngày)</div>
            <div className="delta"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-trending" /></svg> +18%</div>
          </div>
          <div className="stat-tile">
            <div className="ic-b" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
              <svg className="ic"><use href="#ic-file-text" /></svg>
            </div>
            <div className="num">5</div>
            <div className="lbl">Báo giá mới</div>
            <div className="delta"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-trending" /></svg> +2 hôm nay</div>
          </div>
          <div className="stat-tile">
            <div className="ic-b" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
              <svg className="ic"><use href="#ic-people" /></svg>
            </div>
            <div className="num">12</div>
            <div className="lbl">Kết nối đang mở</div>
          </div>
          <div className="stat-tile">
            <div className="ic-b" style={{ background: '#eaf7ee', color: 'var(--green)' }}>
              <svg className="ic"><use href="#ic-star-f" /></svg>
            </div>
            <div className="num">4.9</div>
            <div className="lbl">Điểm đánh giá TB</div>
          </div>
        </div>

        <div className="grid-side-r" style={{ gap: 20 }}>
          <div>
            {/* Trust + completeness */}
            <div className="grid-2 mb-24" style={{ gap: 20 }}>
              <div className="dcard" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="trust-ring" style={{ ['--val' as never]: 95 }}>
                  <div className="inner"><b>95</b><small>/100</small></div>
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Trust Score</h3>
                  <p className="muted" style={{ fontSize: 13 }}>
                    Top 3% ngành xây dựng.<br />
                    Tăng <b style={{ color: 'var(--green)' }}>+2 điểm</b> tháng này.
                  </p>
                  <a href="/dashboard/verify" style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 12.5 }}>
                    Cách nâng điểm →
                  </a>
                </div>
              </div>
              <div className="dcard">
                <h3>Độ hoàn thiện hồ sơ <b style={{ color: 'var(--orange)' }}>92%</b></h3>
                <div className="progress mb-16"><div className="bar" style={{ width: '92%' }} /></div>
                <div className="todo done">
                  <span className="ck"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg></span>
                  <span>Thông tin cơ bản &amp; logo</span>
                </div>
                <div className="todo done">
                  <span className="ck"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg></span>
                  <span>Xác minh pháp lý</span>
                </div>
                <div className="todo">
                  <span className="ck" />
                  <span>Thêm video giới thiệu</span>
                  <a href="/dashboard/company-edit">Thêm</a>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="dcard mb-24">
              <h3>
                Hoạt động gần đây{' '}
                <a href="#" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>Xem tất cả</a>
              </h3>
              <div className="act-row">
                <span className="ic-b" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
                  <svg className="ic"><use href="#ic-file-text" /></svg>
                </span>
                <span>Bạn nhận <b>báo giá mới</b> từ Coteccons cho tin &ldquo;Tòa văn phòng 15 tầng&rdquo;</span>
                <small>10 phút trước</small>
              </div>
              <div className="act-row">
                <span className="ic-b" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                  <svg className="ic"><use href="#ic-chat" /></svg>
                </span>
                <span>CTCP Đầu tư Sài Gòn đã <b>nhắn tin</b> cho bạn</span>
                <small>1 giờ trước</small>
              </div>
              <div className="act-row">
                <span className="ic-b" style={{ background: '#eaf7ee', color: 'var(--green)' }}>
                  <svg className="ic"><use href="#ic-star-f" /></svg>
                </span>
                <span>Nhận <b>đánh giá 5★</b> từ Vinhomes Project Management</span>
                <small>Hôm qua</small>
              </div>
              <div className="act-row">
                <span className="ic-b" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <svg className="ic"><use href="#ic-shield-check" /></svg>
                </span>
                <span>Chứng chỉ năng lực <b>Hạng I đã được xác minh</b></span>
                <small>2 ngày trước</small>
              </div>
            </div>

            {/* My listings */}
            <div className="dcard">
              <h3>
                Tin đăng của tôi{' '}
                <a href="/marketplace" style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 600 }}>Quản lý</a>
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tiêu đề</th><th>Loại</th><th>Báo giá</th><th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>Cung cấp 500 tấn thép D16–D25</b></td>
                    <td>Nhà cung cấp</td><td>11</td>
                    <td><span className="badge green">Đang mở</span></td>
                  </tr>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>Tìm đội sơn bả hoàn thiện</b></td>
                    <td>Đội thi công</td><td>4</td>
                    <td><span className="badge green">Đang mở</span></td>
                  </tr>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>Thuê cẩu tháp 6 tháng</b></td>
                    <td>Nhà cung cấp</td><td>7</td>
                    <td><span className="badge gray">Đã đóng</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <aside>
            <div className="dcard mb-24">
              <h3>
                <svg className="ic" style={{ width: 18, height: 18, color: 'var(--orange)' }}><use href="#ic-bell" /></svg>
                {' '}Thông báo
              </h3>
              <div className="act-row" style={{ padding: '9px 0' }}>
                <span className="ic-b" style={{ background: 'var(--orange-soft)', color: 'var(--orange)' }}>
                  <svg className="ic"><use href="#ic-file-text" /></svg>
                </span>
                <span style={{ fontSize: 13 }}>3 báo giá đang chờ phản hồi</span>
              </div>
              <div className="act-row" style={{ padding: '9px 0' }}>
                <span className="ic-b" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                  <svg className="ic"><use href="#ic-chat" /></svg>
                </span>
                <span style={{ fontSize: 13 }}>3 tin nhắn chưa đọc</span>
              </div>
              <div className="act-row" style={{ padding: '9px 0' }}>
                <span className="ic-b" style={{ background: '#fdeaea', color: 'var(--red)' }}>
                  <svg className="ic"><use href="#ic-clock" /></svg>
                </span>
                <span style={{ fontSize: 13 }}>Gói Professional hết hạn trong 8 ngày</span>
              </div>
            </div>

            <div className="dcard" style={{ background: 'linear-gradient(135deg,#021e48,#12439c)', color: '#fff', border: 'none', marginBottom: 24 }}>
              <h3 style={{ color: '#fff' }}>Nâng cấp Enterprise</h3>
              <p style={{ fontSize: 13, color: '#c6d3e2', marginBottom: 14 }}>
                Mở khóa Analytics nâng cao, hồ sơ nổi bật &amp; hỗ trợ ưu tiên.
              </p>
              <a className="btn btn-orange btn-block" href="/pricing">Xem gói →</a>
            </div>

            <div className="dcard">
              <h3>Thành viên (4)</h3>
              <div className="act-row" style={{ padding: '8px 0' }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#12439c', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flex: 'none' }}>NV</span>
                <span style={{ fontSize: 13 }}>Nguyễn Văn A</span><small>Owner</small>
              </div>
              <div className="act-row" style={{ padding: '8px 0' }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#0d6b3f', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flex: 'none' }}>TT</span>
                <span style={{ fontSize: 13 }}>Trần Thị B</span><small>Admin</small>
              </div>
              <div className="act-row" style={{ padding: '8px 0' }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#b5610f', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flex: 'none' }}>LH</span>
                <span style={{ fontSize: 13 }}>Lê Hoàng C</span><small>Editor</small>
              </div>
              <a className="btn btn-outline btn-block btn-sm mt-8">
                <svg className="ic"><use href="#ic-plus" /></svg> Mời thành viên
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
