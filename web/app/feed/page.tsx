import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tin tức ngành' };

const POSTS = [
  {
    initials: 'HB', bg: '#12439c',
    name: 'Xây dựng Hòa Bình',
    time: '2 giờ trước',
    type: { label: 'Dự án hoàn thành', cls: 'green', icon: 'ic-check' },
    body: '🎉 Hòa Bình chính thức bàn giao <b>Landmark Tower — 42 tầng</b> tại TP.HCM, vượt tiến độ 15 ngày! Cảm ơn chủ đầu tư đã tin tưởng đồng hành. Công trình đạt chứng nhận an toàn lao động xuất sắc.',
    img: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1000&q=75',
    likes: 214, comments: 32, shares: 12,
  },
  {
    initials: 'AP', bg: '#c0392b',
    name: 'An Phong Construction',
    time: '5 giờ trước',
    type: { label: 'Tuyển dụng', cls: 'orange', icon: 'ic-people' },
    body: '📢 <b>TUYỂN GẤP:</b> 05 Kỹ sư giám sát M&E và 02 Chỉ huy trưởng cho dự án khách sạn tại Đà Nẵng. Lương cạnh tranh 20–35 triệu + phụ cấp công trình. Inbox hoặc gửi CV qua nền tảng.',
    img: '',
    likes: 48, comments: 15, shares: 0,
  },
  {
    initials: 'TC', bg: '#0d6b3f',
    name: 'Vật liệu Thành Công',
    time: 'Hôm qua',
    type: { label: 'Chứng nhận', cls: '', icon: 'ic-award' },
    body: '🏆 Chúng tôi vừa đạt <b>chứng nhận ISO 9001:2015</b> cho hệ thống quản lý chất lượng vật liệu xây dựng. Cam kết cung cấp sản phẩm đạt chuẩn cho mọi công trình.',
    img: '',
    likes: 96, comments: 8, shares: 0,
  },
];

export default function FeedPage() {
  return (
    <>
      <style>{`
        .feed-grid{display:grid;grid-template-columns:240px 1fr 300px;gap:24px;align-items:start}
        .side-card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm);margin-bottom:18px}
        .side-nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;font-size:14px;font-weight:600;color:var(--text);text-decoration:none}
        .side-nav a svg{width:18px;height:18px;color:var(--muted)}
        .side-nav a.active{background:var(--orange-soft);color:var(--orange)}
        .side-nav a.active svg{color:var(--orange)}
        .side-nav a:hover:not(.active){background:#f6f8fb}
        .composer{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:var(--shadow-sm);margin-bottom:20px}
        .composer .top{display:flex;gap:12px;align-items:center}
        .composer input{flex:1;border:1px solid var(--line);border-radius:24px;padding:11px 16px;font-size:14px;background:#f6f8fb}
        .composer .acts{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
        .composer .acts .a{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--muted);padding:7px 12px;border-radius:8px;cursor:pointer}
        .composer .acts .a:hover{background:#f6f8fb}
        .composer .acts .a svg{width:16px;height:16px}
        .post{background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-sm);margin-bottom:20px;overflow:hidden}
        .post .head{display:flex;gap:12px;align-items:center;padding:16px 18px 0}
        .post .head .ava{width:46px;height:46px;border-radius:11px;font-weight:800;color:#fff;display:grid;place-items:center;flex:none;font-size:16px}
        .post .head h4{font-size:14.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:6px}
        .post .head small{font-size:12px;color:var(--muted)}
        .post .ptype{margin:12px 18px 0}
        .post .body{padding:12px 18px}
        .post .body p{font-size:14px;color:#31414f;line-height:1.65}
        .post .pimg{width:100%;max-height:360px;object-fit:cover;margin-top:6px}
        .post .stats{padding:10px 18px;font-size:12.5px;color:var(--muted);display:flex;gap:16px;border-top:1px solid var(--line-2)}
        .post .actions{display:flex;border-top:1px solid var(--line-2)}
        .post .actions a{flex:1;padding:11px;text-align:center;font-size:13.5px;font-weight:600;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;cursor:pointer}
        .post .actions a:hover{background:#f6f8fb;color:var(--navy)}
        .post .actions svg{width:17px;height:17px}
        .trend a{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:13px;text-decoration:none;color:inherit}
        .trend a:last-child{border-bottom:none}
        .trend a b{color:var(--navy)}
        .trend a span{color:var(--muted);font-size:12px}
        .sugg{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line-2)}
        .sugg:last-child{border-bottom:none}
        .sugg .ava-s{width:38px;height:38px;border-radius:9px;font-weight:800;color:#fff;display:grid;place-items:center;font-size:13px;flex:none}
        .sugg h5{font-size:13px;font-weight:700;color:var(--navy)}
        .sugg small{font-size:11.5px;color:var(--muted)}
        @media(max-width:1024px){.feed-grid{grid-template-columns:1fr}.feed-grid aside{display:none}}
      `}</style>

      <div className="container" style={{ padding: '24px 20px 48px' }}>
        <div className="feed-grid">
          {/* LEFT NAV */}
          <aside>
            <div className="side-card side-nav">
              <a className="active" href="/feed">
                <svg className="ic"><use href="#ic-layers" /></svg> Tất cả tin
              </a>
              <a href="/feed?type=project">
                <svg className="ic"><use href="#ic-building" /></svg> Công trình mới
              </a>
              <a href="/feed?type=done">
                <svg className="ic"><use href="#ic-check" /></svg> Dự án hoàn thành
              </a>
              <a href="/feed?type=hiring">
                <svg className="ic"><use href="#ic-people" /></svg> Tuyển dụng
              </a>
              <a href="/feed?type=cert">
                <svg className="ic"><use href="#ic-award" /></svg> Chứng nhận
              </a>
              <a href="/feed?type=promo">
                <svg className="ic"><use href="#ic-tag" /></svg> Khuyến mại
              </a>
              <a href="/feed?type=following">
                <svg className="ic"><use href="#ic-heart" /></svg> Đang theo dõi
              </a>
            </div>
          </aside>

          {/* FEED */}
          <div>
            {/* Composer */}
            <div className="composer">
              <div className="top">
                <span className="post .head .ava" style={{ width: 42, height: 42, borderRadius: 10, background: '#12439c', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>HB</span>
                <input placeholder="Chia sẻ cập nhật của Hòa Bình: công trình mới, tin tuyển dụng…" />
              </div>
              <div className="acts">
                <span className="a"><svg className="ic" style={{ color: '#22a06b' }}><use href="#ic-image" /></svg> Ảnh</span>
                <span className="a"><svg className="ic" style={{ color: '#e0455e' }}><use href="#ic-video" /></svg> Video</span>
                <span className="a"><svg className="ic" style={{ color: '#2a5a9e' }}><use href="#ic-building" /></svg> Dự án</span>
                <span className="a"><svg className="ic" style={{ color: '#d97706' }}><use href="#ic-people" /></svg> Tuyển dụng</span>
                <button className="btn btn-orange btn-sm" style={{ marginLeft: 'auto' }}>Đăng bài</button>
              </div>
            </div>

            {/* Posts */}
            {POSTS.map((post, i) => (
              <article key={i} className="post">
                <div className="head">
                  <span className="ava" style={{ width: 46, height: 46, borderRadius: 11, background: post.bg, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                    {post.initials}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h4>
                      {post.name}
                      <svg className="ic" style={{ width: 15, height: 15, color: 'var(--green)' }}><use href="#ic-shield-check" /></svg>
                    </h4>
                    <small>
                      {post.time} ·{' '}
                      <svg className="ic" style={{ width: 12, height: 12, verticalAlign: -1 }}><use href="#ic-globe" /></svg>{' '}
                      Công khai
                    </small>
                  </div>
                  <a className="btn btn-icon btn-outline" style={{ border: 'none' }}>
                    <svg className="ic"><use href="#ic-dots" /></svg>
                  </a>
                </div>
                <div className="ptype">
                  <span className={`badge ${post.type.cls}`}>
                    <svg className="ic"><use href={`#${post.type.icon}`} /></svg> {post.type.label}
                  </span>
                </div>
                <div className="body">
                  <p dangerouslySetInnerHTML={{ __html: post.body }} />
                </div>
                {post.img && <img className="pimg" src={post.img} alt="" />}
                <div className="stats">
                  <span>
                    <svg className="ic fill" style={{ width: 14, height: 14, color: 'var(--orange)', verticalAlign: -2 }}><use href="#ic-thumb" /></svg> {post.likes}
                  </span>
                  {post.comments > 0 && <span>{post.comments} bình luận</span>}
                  {post.shares > 0 && <span>{post.shares} chia sẻ</span>}
                </div>
                <div className="actions">
                  <a><svg className="ic"><use href="#ic-thumb" /></svg> Thích</a>
                  <a><svg className="ic"><use href="#ic-chat" /></svg> Bình luận</a>
                  <a><svg className="ic"><use href="#ic-link" /></svg> Chia sẻ</a>
                </div>
              </article>
            ))}
          </div>

          {/* RIGHT */}
          <aside>
            <div className="side-card">
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Xu hướng ngành</h4>
              <div className="trend">
                <a href="#">
                  <span><b>Giá thép tăng 3%</b><br /><span>Chỉ số giá vật liệu</span></span>
                  <svg className="ic" style={{ width: 16, height: 16, color: 'var(--green)' }}><use href="#ic-trending" /></svg>
                </a>
                <a href="#"><span><b>#DauThauOnline</b><br /><span>1.2k thảo luận</span></span></a>
                <a href="#"><span><b>#ChungChiNangLuc</b><br /><span>860 thảo luận</span></span></a>
                <a href="#"><span><b>#XanhHoaCongTrinh</b><br /><span>540 thảo luận</span></span></a>
              </div>
            </div>
            <div className="side-card">
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>Gợi ý theo dõi</h4>
              <div className="sugg">
                <span className="ava-s" style={{ background: '#111' }}>CT</span>
                <div style={{ flex: 1 }}>
                  <h5>Coteccons</h5>
                  <small>Nhà thầu · TP.HCM</small>
                </div>
                <a className="btn btn-outline btn-sm">Theo dõi</a>
              </div>
              <div className="sugg">
                <span className="ava-s" style={{ background: '#17479e' }}>DL</span>
                <div style={{ flex: 1 }}>
                  <h5>Delta Group</h5>
                  <small>Nhà thầu · Hà Nội</small>
                </div>
                <a className="btn btn-outline btn-sm">Theo dõi</a>
              </div>
              <div className="sugg">
                <span className="ava-s" style={{ background: '#0d6b3f' }}>HP</span>
                <div style={{ flex: 1 }}>
                  <h5>Thép Hòa Phát</h5>
                  <small>Nhà cung cấp</small>
                </div>
                <a className="btn btn-outline btn-sm">Theo dõi</a>
              </div>
            </div>
            <div className="side-card" style={{ background: 'linear-gradient(135deg,#021e48,#12439c)', color: '#fff', border: 'none' }}>
              <h4 style={{ color: '#fff', fontSize: 15 }}>Nâng cấp hồ sơ nổi bật</h4>
              <p style={{ fontSize: 13, color: '#c6d3e2', margin: '8px 0 14px' }}>
                Bài viết &amp; hồ sơ của bạn hiển thị ưu tiên với gói Professional.
              </p>
              <a className="btn btn-orange btn-block" href="/pricing">Xem gói →</a>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
