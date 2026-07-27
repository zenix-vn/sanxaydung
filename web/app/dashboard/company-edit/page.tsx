import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chỉnh sửa hồ sơ' };

export default function CompanyEditPage() {
  return (
    <>
      <style>{`
        .edit-grid{display:grid;grid-template-columns:230px 1fr;gap:24px;align-items:start}
        .sec-nav{position:sticky;top:82px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:var(--shadow-sm)}
        .sec-nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;font-size:13.5px;font-weight:600;color:var(--text);text-decoration:none}
        .sec-nav a svg{width:17px;height:17px;color:var(--muted)}
        .sec-nav a.active{background:var(--orange-soft);color:var(--orange)}
        .sec-nav a.active svg{color:var(--orange)}
        .sec-nav a:hover:not(.active){background:#f6f8fb}
        .media-edit{display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap}
        .cover-up{flex:1;min-width:260px;height:130px;border-radius:12px;background:linear-gradient(120deg,rgba(2,30,72,.4),rgba(2,30,72,.1)),url("https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=70") center/cover;display:grid;place-items:center;position:relative}
        .logo-up{width:100px;height:100px;border-radius:16px;background:#12439c;color:#fff;display:grid;place-items:center;font-weight:800;font-size:30px;position:relative;flex:none}
        .logo-up .cam{position:absolute;bottom:-6px;right:-6px;width:34px;height:34px;border-radius:50%;background:var(--orange);color:#fff;display:grid;place-items:center;border:3px solid #fff}
        .logo-up .cam svg{width:16px;height:16px}
        .savebar{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:14px 0;display:flex;justify-content:flex-end;gap:12px;z-index:40}
        .tagpick{display:flex;gap:8px;flex-wrap:wrap}
        .completeness-widget{background:linear-gradient(135deg,#021e48,#12439c);color:#fff;border-radius:14px;padding:18px}
        .completeness-widget .n{font-size:30px;font-weight:800}
        .completeness-widget .progress{background:rgba(255,255,255,.2);margin:10px 0 14px}
        .completeness-widget li{list-style:none;font-size:12.5px;color:#c6d3e2;display:flex;align-items:center;gap:8px;padding:4px 0}
        .completeness-widget li svg{width:14px;height:14px;flex:none}
        .hint{font-size:12px;color:var(--muted);margin-top:5px}
        .table{width:100%;border-collapse:collapse;font-size:13.5px}
        .table th{text-align:left;padding:8px 12px;color:var(--muted);font-weight:600;font-size:12.5px;border-bottom:1px solid var(--line)}
        .table td{padding:10px 12px;border-bottom:1px solid var(--line-2)}
        .table tr:last-child td{border-bottom:none}
        @media(max-width:900px){.edit-grid{grid-template-columns:1fr}.sec-nav{position:static;display:flex;flex-wrap:wrap;gap:4px}}
      `}</style>

      <section className="pagehead" style={{ padding: '22px 0' }}>
        <div className="container">
          <div className="crumb">
            <a href="/dashboard">Bảng điều khiển</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Chỉnh sửa hồ sơ
          </div>
          <div className="between">
            <h1>Chỉnh sửa hồ sơ doanh nghiệp</h1>
            <a className="btn btn-ghost" href="/cong-ty/hoa-binh">
              <svg className="ic"><use href="#ic-eye" /></svg> Xem trước
            </a>
          </div>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 26 }}>
        <div className="container edit-grid">
          {/* Section nav + completeness */}
          <div>
            <nav className="sec-nav mb-24">
              <a className="active" href="#basic"><svg className="ic"><use href="#ic-building" /></svg> Thông tin cơ bản</a>
              <a href="#media"><svg className="ic"><use href="#ic-image" /></svg> Logo &amp; ảnh bìa</a>
              <a href="#field"><svg className="ic"><use href="#ic-briefcase" /></svg> Lĩnh vực &amp; khu vực</a>
              <a href="#intro"><svg className="ic"><use href="#ic-file-text" /></svg> Giới thiệu</a>
              <a href="#projects"><svg className="ic"><use href="#ic-clipboard" /></svg> Dự án</a>
              <a href="#services"><svg className="ic"><use href="#ic-tag" /></svg> Dịch vụ</a>
              <a href="#docs"><svg className="ic"><use href="#ic-folder" /></svg> Hồ sơ năng lực</a>
              <a href="#contact"><svg className="ic"><use href="#ic-phone" /></svg> Liên hệ</a>
            </nav>
            <div className="completeness-widget">
              <div>Độ hoàn thiện hồ sơ</div>
              <div className="n">92%</div>
              <div className="progress"><div className="bar" style={{ width: '92%' }} /></div>
              <ul>
                <li><svg className="ic" style={{ color: '#4ade80' }}><use href="#ic-check" /></svg> Thông tin cơ bản</li>
                <li><svg className="ic" style={{ color: '#4ade80' }}><use href="#ic-check" /></svg> Logo &amp; ảnh bìa</li>
                <li><svg className="ic" style={{ color: '#4ade80' }}><use href="#ic-check" /></svg> 128 dự án</li>
                <li><svg className="ic" style={{ color: 'var(--orange-2)' }}><use href="#ic-plus" /></svg> Thêm video giới thiệu</li>
                <li><svg className="ic" style={{ color: 'var(--orange-2)' }}><use href="#ic-plus" /></svg> Thêm bảng giá dịch vụ</li>
              </ul>
            </div>
          </div>

          {/* Form */}
          <div>
            {/* Basic info */}
            <div className="card-block" id="basic">
              <h2>Thông tin cơ bản</h2>
              <p className="muted mb-16">Thông tin nhận diện doanh nghiệp trên nền tảng.</p>
              <div className="form-row">
                <div className="field-group">
                  <label>Tên hiển thị <span className="req">*</span></label>
                  <input className="input" defaultValue="Công ty CP Xây dựng Hòa Bình" />
                </div>
                <div className="field-group">
                  <label>Đường dẫn hồ sơ (slug)</label>
                  <div style={{ position: 'relative' }}>
                    <svg className="ic" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}><use href="#ic-link" /></svg>
                    <input className="input" defaultValue="hoa-binh" style={{ paddingLeft: 40 }} />
                  </div>
                  <div className="hint">sanxaydung.vn/cong-ty/<b>hoa-binh</b></div>
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Tên pháp lý</label>
                  <input className="input" defaultValue="CÔNG TY CỔ PHẦN XÂY DỰNG HÒA BÌNH" />
                </div>
                <div className="field-group">
                  <label>Mã số thuế <span className="badge green" style={{ fontWeight: 600 }}><svg className="ic"><use href="#ic-check" /></svg> Verified</span></label>
                  <input className="input" defaultValue="0301234567" readOnly style={{ background: '#f6fdf9' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Năm thành lập</label>
                  <input className="input" defaultValue="1987" />
                </div>
                <div className="field-group">
                  <label>Quy mô nhân sự</label>
                  <select className="select">
                    <option>1–10 người</option>
                    <option>11–50 người</option>
                    <option>51–200 người</option>
                    <option selected>Trên 200 người</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="card-block" id="media">
              <h2>Logo &amp; ảnh bìa</h2>
              <p className="muted mb-16">Lưu trên bucket công khai <code>company-logos</code>, path theo <code>company_id/</code>.</p>
              <div className="media-edit">
                <div className="logo-up">
                  HB
                  <span className="cam"><svg className="ic"><use href="#ic-camera" /></svg></span>
                </div>
                <div className="cover-up">
                  <span className="btn" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--navy)' }}>
                    <svg className="ic"><use href="#ic-camera" /></svg> Đổi ảnh bìa
                  </span>
                </div>
              </div>
            </div>

            {/* Field & area */}
            <div className="card-block" id="field">
              <h2>Lĩnh vực &amp; khu vực hoạt động</h2>
              <p className="muted mb-16">Giúp doanh nghiệp xuất hiện đúng bộ lọc &amp; gợi ý AI Matching (GĐ2).</p>
              <div className="field-group">
                <label>Nhóm &amp; lĩnh vực</label>
                <div className="tagpick">
                  <span className="chip active">Tổng thầu <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip active">Nhà cao tầng <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip active">Kết cấu BTCT <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip active">Cơ điện M&amp;E <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip"><svg className="ic"><use href="#ic-plus" /></svg> Thêm lĩnh vực</span>
                </div>
              </div>
              <div className="field-group">
                <label>Khu vực hoạt động</label>
                <div className="tagpick">
                  <span className="chip active">TP.HCM <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip active">Hà Nội <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip active">Bình Dương <svg className="ic"><use href="#ic-x" /></svg></span>
                  <span className="chip"><svg className="ic"><use href="#ic-plus" /></svg> Thêm tỉnh/thành</span>
                </div>
              </div>
            </div>

            {/* Intro */}
            <div className="card-block" id="intro">
              <h2>Giới thiệu doanh nghiệp</h2>
              <p className="muted mb-16">Nội dung này tối ưu SEO cho Company Page (schema.org Organization).</p>
              <div className="field-group">
                <label>Mô tả ngắn (intro)</label>
                <input className="input" defaultValue="Tổng thầu xây dựng hàng đầu — 35 năm kinh nghiệm nhà cao tầng & hạ tầng." />
              </div>
              <div className="field-group">
                <label>Giới thiệu chi tiết</label>
                <textarea className="textarea" style={{ minHeight: 140 }} defaultValue="Công ty CP Xây dựng Hòa Bình là một trong những tổng thầu xây dựng hàng đầu Việt Nam với hơn 35 năm kinh nghiệm..." />
              </div>
            </div>

            {/* Projects */}
            <div className="card-block" id="projects">
              <h2 className="between">
                <span>Dự án portfolio</span>
                <a className="btn btn-outline btn-sm"><svg className="ic"><use href="#ic-plus" /></svg> Thêm dự án</a>
              </h2>
              <table className="table">
                <thead>
                  <tr><th>Dự án</th><th>Vai trò</th><th>Năm</th><th>Khu vực</th><th></th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>Landmark Tower — 42 tầng</b></td>
                    <td>Tổng thầu</td><td>2023</td><td>TP.HCM</td>
                    <td><a href="#"><svg className="ic" style={{ width: 16, height: 16, color: 'var(--muted)' }}><use href="#ic-edit" /></svg></a></td>
                  </tr>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>KCN Long Hậu — Nhà xưởng</b></td>
                    <td>Tổng thầu</td><td>2022</td><td>Long An</td>
                    <td><a href="#"><svg className="ic" style={{ width: 16, height: 16, color: 'var(--muted)' }}><use href="#ic-edit" /></svg></a></td>
                  </tr>
                  <tr>
                    <td><b style={{ color: 'var(--navy)' }}>Bệnh viện Đa khoa 500 giường</b></td>
                    <td>Tổng thầu</td><td>2021</td><td>Bình Dương</td>
                    <td><a href="#"><svg className="ic" style={{ width: 16, height: 16, color: 'var(--muted)' }}><use href="#ic-edit" /></svg></a></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Docs */}
            <div className="card-block" id="docs">
              <h2 className="between">
                <span>Hồ sơ năng lực</span>
                <a className="btn btn-outline btn-sm"><svg className="ic"><use href="#ic-upload" /></svg> Tải tài liệu</a>
              </h2>
              <p className="muted mb-16">Đặt mức riêng tư: công khai / thành viên / chỉ đối tác đã kết nối.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg className="ic" style={{ color: 'var(--blue)' }}><use href="#ic-file-text" /></svg> Giấy chứng nhận ĐKKD
                </span>
                <select className="select" style={{ width: 'auto' }}>
                  <option>Công khai</option><option>Thành viên</option><option>Đối tác kết nối</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg className="ic" style={{ color: 'var(--blue)' }}><use href="#ic-lock" /></svg> Company Profile 2024 (24MB)
                </span>
                <select className="select" style={{ width: 'auto' }}>
                  <option>Đối tác kết nối</option><option>Công khai</option><option>Thành viên</option>
                </select>
              </div>
            </div>

            {/* Contact */}
            <div className="card-block" id="contact">
              <h2>Thông tin liên hệ</h2>
              <div className="form-row">
                <div className="field-group">
                  <label>Điện thoại</label>
                  <div style={{ position: 'relative' }}>
                    <svg className="ic" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}><use href="#ic-phone" /></svg>
                    <input className="input" defaultValue="028 3932 0000" style={{ paddingLeft: 40 }} />
                  </div>
                </div>
                <div className="field-group">
                  <label>Email</label>
                  <div style={{ position: 'relative' }}>
                    <svg className="ic" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}><use href="#ic-mail" /></svg>
                    <input className="input" defaultValue="info@hbc.vn" style={{ paddingLeft: 40 }} />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="field-group">
                  <label>Website</label>
                  <div style={{ position: 'relative' }}>
                    <svg className="ic" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}><use href="#ic-globe" /></svg>
                    <input className="input" defaultValue="hbcg.vn" style={{ paddingLeft: 40 }} />
                  </div>
                </div>
                <div className="field-group">
                  <label>Tỉnh/thành trụ sở</label>
                  <select className="select">
                    <option selected>TP. Hồ Chí Minh</option>
                    <option>Hà Nội</option>
                    <option>Đà Nẵng</option>
                  </select>
                </div>
              </div>
              <div className="field-group">
                <label>Địa chỉ</label>
                <input className="input" defaultValue="235 Võ Thị Sáu, Phường 7, Quận 3, TP.HCM" />
              </div>
            </div>

            <div className="savebar">
              <a className="btn btn-outline" href="/dashboard">Hủy</a>
              <button className="btn btn-outline">Lưu nháp</button>
              <button className="btn btn-orange">
                <svg className="ic"><use href="#ic-check" /></svg> Lưu &amp; xuất bản
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
