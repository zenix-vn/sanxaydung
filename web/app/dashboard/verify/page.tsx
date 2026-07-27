import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Xác minh doanh nghiệp' };

export default function VerifyPage() {
  return (
    <>
      <style>{`
        .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:26px}
        .tier{border:1px solid var(--line);border-radius:16px;padding:22px;background:#fff;box-shadow:var(--shadow-sm);position:relative}
        .tier.done{border-color:var(--green);background:linear-gradient(0deg,#f6fdf9,#fff)}
        .tier.active{border-color:var(--orange);box-shadow:0 8px 30px rgba(241,138,28,.16)}
        .tier .step{position:absolute;top:-11px;left:22px;font-size:11px;font-weight:700;background:var(--navy);color:#fff;padding:3px 12px;border-radius:20px}
        .tier .badge-lg{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;margin-bottom:14px}
        .tier h3{font-size:17px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:8px}
        .tier p{font-size:13px;color:var(--muted);margin:8px 0 14px}
        .tier ul{list-style:none;padding:0;margin:0}
        .tier li{font-size:13px;color:var(--text);display:flex;align-items:center;gap:8px;padding:4px 0}
        .tier li svg{width:15px;height:15px;color:var(--green);flex:none}
        .tier .vstatus{margin-top:14px;font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:6px}
        .lookup-result{background:#f6fdf9;border:1px solid #b6e6c9;border-radius:12px;padding:16px;margin-top:16px}
        .lookup-result .kv{display:flex;justify-content:space-between;font-size:13.5px;padding:6px 0;border-bottom:1px dashed #cbead6}
        .lookup-result .kv:last-child{border-bottom:none}
        .lookup-result .kv .k{color:#4a7a5f}.lookup-result .kv .v{font-weight:600;color:var(--navy)}
        .steps-flow{display:flex;gap:8px;align-items:center;margin-bottom:22px;flex-wrap:wrap}
        .steps-flow .s{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
        .steps-flow .s .n{width:26px;height:26px;border-radius:50%;background:var(--line);color:var(--muted);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
        .steps-flow .s.done .n{background:var(--green);color:#fff}
        .steps-flow .s.active .n{background:var(--orange);color:#fff}
        .steps-flow .s.active{color:var(--navy);font-weight:600}
        .steps-flow .line{flex:1;height:2px;background:var(--line);min-width:20px}
        .upload-zone{border:1.5px dashed var(--line);border-radius:10px;padding:20px;text-align:center;color:var(--muted)}
        @media(max-width:900px){.tiers{grid-template-columns:1fr}}
      `}</style>

      <section className="pagehead">
        <div className="container">
          <div className="crumb">
            <a href="/dashboard">Bảng điều khiển</a>
            <svg className="ic"><use href="#ic-chevron-right" /></svg>
            Xác minh doanh nghiệp
          </div>
          <h1>Xác minh doanh nghiệp</h1>
          <p>Gắn dữ liệu gốc (MST, chứng chỉ năng lực) để nâng huy hiệu tin cậy &amp; tăng Trust Score. Xác minh giúp bạn nhận nhiều báo giá &amp; cơ hội hơn.</p>
        </div>
      </section>

      <section className="block" style={{ paddingTop: 28 }}>
        <div className="container">
          {/* Tiers */}
          <div className="tiers">
            <div className="tier done">
              <span className="step">Bước 1</span>
              <div className="badge-lg" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>
                <svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-shield-check" /></svg>
              </div>
              <h3>Xác minh pháp lý</h3>
              <p>Tra cứu Mã số thuế / Giấy phép kinh doanh qua Cổng thông tin quốc gia về ĐKDN.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đã xác minh pháp lý&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> +14 điểm Trust Score</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Được đăng tin &amp; báo giá</li>
              </ul>
              <div className="vstatus" style={{ color: 'var(--green)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href="#ic-check" /></svg> Đã hoàn tất
              </div>
            </div>

            <div className="tier active">
              <span className="step">Bước 2</span>
              <div className="badge-lg" style={{ background: '#eaf7ee', color: 'var(--green)' }}>
                <svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-award" /></svg>
              </div>
              <h3>Xác minh năng lực</h3>
              <p>Chứng chỉ năng lực hoạt động xây dựng hạng I/II/III do Bộ Xây dựng cấp.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đã xác minh năng lực&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> +6 điểm Trust Score</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Lọc theo hạng năng lực</li>
              </ul>
              <div className="vstatus" style={{ color: 'var(--orange)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href="#ic-clock" /></svg> Đang xử lý
              </div>
            </div>

            <div className="tier">
              <span className="step">Bước 3</span>
              <div className="badge-lg" style={{ background: 'linear-gradient(135deg,#fff2d1,#ffe4a3)', color: '#8a6d1a' }}>
                <svg className="ic" style={{ width: 28, height: 28 }}><use href="#ic-star-f" /></svg>
              </div>
              <h3>Đối tác vàng</h3>
              <p>Đạt ngưỡng Trust Score + số dự án + đánh giá xác thực để nhận huy hiệu cao nhất.</p>
              <ul>
                <li><svg className="ic"><use href="#ic-check" /></svg> Huy hiệu &ldquo;Đối tác vàng&rdquo;</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Ưu tiên hiển thị tìm kiếm</li>
                <li><svg className="ic"><use href="#ic-check" /></svg> Nổi bật trong bảng xếp hạng</li>
              </ul>
              <div className="vstatus" style={{ color: 'var(--muted)' }}>
                <svg className="ic" style={{ width: 15, height: 15 }}><use href="#ic-lock" /></svg> Cần Trust Score ≥ 90
              </div>
            </div>
          </div>

          <div className="grid-side-r">
            {/* Form */}
            <div>
              <div className="card-block">
                <h2>Xác minh năng lực — Chứng chỉ hoạt động xây dựng</h2>
                <p className="muted mb-16">Nhập số chứng chỉ để hệ thống đối chiếu; hoặc tải file chứng chỉ để đội ngũ xác minh thủ công.</p>

                <div className="steps-flow">
                  <div className="s done">
                    <span className="n"><svg className="ic" style={{ width: 13, height: 13 }}><use href="#ic-check" /></svg></span>
                    Nhập thông tin
                  </div>
                  <span className="line" />
                  <div className="s active">
                    <span className="n">2</span> Đối chiếu dữ liệu
                  </div>
                  <span className="line" />
                  <div className="s">
                    <span className="n">3</span> Cấp huy hiệu
                  </div>
                </div>

                <div className="form-row">
                  <div className="field-group">
                    <label>Số chứng chỉ năng lực <span className="req">*</span></label>
                    <input className="input" defaultValue="BXD-01234/2023" />
                  </div>
                  <div className="field-group">
                    <label>Hạng</label>
                    <select className="select">
                      <option>Hạng I</option>
                      <option>Hạng II</option>
                      <option>Hạng III</option>
                    </select>
                  </div>
                </div>
                <div className="field-group">
                  <label>Lĩnh vực hoạt động trên chứng chỉ</label>
                  <input className="input" defaultValue="Thi công xây dựng công trình dân dụng, công nghiệp" />
                </div>
                <div className="field-group">
                  <label>File chứng chỉ (bằng chứng) <span className="req">*</span></label>
                  <div className="upload-zone">
                    <svg className="ic" style={{ width: 26, height: 26, color: 'var(--orange)', margin: '0 auto 6px', display: 'block' }}><use href="#ic-upload" /></svg>
                    <div style={{ fontSize: 13.5 }}>
                      <b style={{ color: 'var(--navy)' }}>chung-chi-nang-luc-hang-I.pdf</b> · 2.4 MB
                    </div>
                    <small>Tải lên bucket riêng tư <code>verification-docs</code> — chỉ chủ sở hữu &amp; admin xem.</small>
                  </div>
                </div>
                <div className="pill-note mb-16">
                  <svg className="ic"><use href="#ic-shield" /></svg>
                  <span>Việc xác minh chạy trên <b>Edge Function</b> với quyền hệ thống, không lộ dữ liệu ra client. Kết quả sẽ tự cập nhật huy hiệu &amp; Trust Score.</span>
                </div>
                <button className="btn btn-orange btn-lg">
                  <svg className="ic"><use href="#ic-shield-check" /></svg> Gửi yêu cầu xác minh
                </button>
              </div>

              <div className="card-block">
                <h2>Tra cứu Mã số thuế (đã xác minh)</h2>
                <p className="muted mb-16">Kết quả tra cứu từ Cổng thông tin quốc gia về đăng ký doanh nghiệp.</p>
                <div style={{ position: 'relative', maxWidth: 360 }}>
                  <svg className="ic" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}>
                    <use href="#ic-search" />
                  </svg>
                  <input className="input" defaultValue="0301234567" style={{ paddingLeft: 40 }} />
                </div>
                <div className="lookup-result">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <span className="badge green"><svg className="ic"><use href="#ic-check" /></svg> Khớp dữ liệu quốc gia</span>
                  </div>
                  <div className="kv"><span className="k">Tên doanh nghiệp</span><span className="v">CÔNG TY CỔ PHẦN XÂY DỰNG HÒA BÌNH</span></div>
                  <div className="kv"><span className="k">Mã số thuế</span><span className="v">0301234567</span></div>
                  <div className="kv"><span className="k">Tình trạng</span><span className="v" style={{ color: 'var(--green)' }}>Đang hoạt động</span></div>
                  <div className="kv"><span className="k">Ngày cấp</span><span className="v">27/09/1987</span></div>
                  <div className="kv"><span className="k">Người đại diện</span><span className="v">Nguyễn Văn A</span></div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside>
              <div className="card-block" style={{ textAlign: 'center' }}>
                <div className="trust-ring" style={{ ['--val' as never]: 95, margin: '0 auto 12px' }}>
                  <div className="inner"><b>95</b><small>/100</small></div>
                </div>
                <h2 style={{ fontSize: 16 }}>Trust Score hiện tại</h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  Hoàn tất xác minh năng lực để giữ vững vị trí <b style={{ color: 'var(--green)' }}>Top 3%</b> ngành.
                </p>
              </div>
              <div className="card-block">
                <h2 style={{ fontSize: 15 }}>Vì sao nên xác minh?</h2>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-trending" /></svg>
                  Doanh nghiệp đã xác minh nhận báo giá nhiều hơn <b>3.2×</b>
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-2)', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-shield-check" /></svg>
                  Chống công ty ma, tăng niềm tin đối tác
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '10px 0', fontSize: 13, alignItems: 'flex-start' }}>
                  <svg className="ic" style={{ width: 18, height: 18, color: 'var(--green)', flexShrink: 0 }}><use href="#ic-award" /></svg>
                  Điều kiện để lên &ldquo;Đối tác vàng&rdquo;
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
