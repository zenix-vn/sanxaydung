import NavMenu from '@/components/NavMenu';
import RegisterSW from '@/components/RegisterSW';
import Analytics from '@/components/Analytics';

// Khung giao diện của sàn (đầu trang, chân trang, service worker, thống kê truy cập).
export default function SanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterSW />
      <Analytics />

      {/* ===== Header ===== */}
      <header>
        <div className="container nav">
          <a className="brand" href="/">
            <img className="logo" src="/logo.png" alt="Sàn Xây Dựng" />
            <div>
              <b>SÀN XÂY DỰNG</b>
              <span>Kết nối · Tương lai vững chắc</span>
            </div>
          </a>
          <input type="checkbox" id="navtoggle" className="nav-toggle" />
          <label htmlFor="navtoggle" className="hamburger" aria-label="Mở menu">
            <span></span><span></span><span></span>
          </label>
          <NavMenu />
        </div>
      </header>

      {children}

      {/* ===== Footer ===== */}
      <footer>
        <div className="container">
          <div className="foot-grid">
            <div>
              <div className="brand" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src="/logo.png" alt="Sàn Xây Dựng" style={{ width: 44, height: 44, borderRadius: 9 }} />
                <div>
                  <b style={{ fontSize: 16 }}>SÀN XÂY DỰNG</b>
                  <br />
                  <span style={{ fontSize: 11 }}>Kết nối · Tương lai vững chắc</span>
                </div>
              </div>
              <p className="foot-desc">
                Nền tảng kết nối hệ sinh thái xây dựng toàn diện: nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư.
              </p>
            </div>
            <div>
              <h4>Khám phá</h4>
              <ul>
                <li><a href="/directory">Tìm nhà thầu</a></li>
                <li><a href="/directory?group=crew">Tìm đội thi công</a></li>
                <li><a href="/directory?group=supplier">Nhà cung cấp</a></li>
                <li><a href="/marketplace">Nhu cầu / Báo giá</a></li>
                <li><a href="/feed">Tin tức ngành</a></li>
                <li><a href="/ban-do">Bản đồ doanh nghiệp</a></li>
                <li><a href="/linh-vuc">Theo lĩnh vực &amp; tỉnh</a></li>
              </ul>
            </div>
            <div>
              <h4>Hỗ trợ</h4>
              <ul>
                <li><a href="/huong-dan">Hướng dẫn sử dụng</a></li>
                <li><a href="/cau-hoi-thuong-gap">Câu hỏi thường gặp</a></li>
                <li><a href="/lien-he">Liên hệ</a></li>
              </ul>
            </div>
            <div>
              <h4>Liên hệ</h4>
              <ul>
                <li><svg className="ic"><use href="#ic-mail" /></svg> hotro@sanxaydung.vn</li>
                <li><svg className="ic"><use href="#ic-pin" /></svg> Hà Nội, Việt Nam</li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">© 2026 Sàn Xây Dựng. Bản quyền thuộc về nền tảng Sàn Xây Dựng. · <a href="/dieu-khoan">Điều khoản</a> · <a href="/chinh-sach-bao-mat">Chính sách bảo mật</a></div>
        </div>
      </footer>
    </>
  );
}
