import type { Metadata } from 'next';
import './globals.css';
import IconSprite from '@/components/IconSprite';

export const metadata: Metadata = {
  title: {
    default: 'Sàn Xây Dựng — Hệ sinh thái xây dựng toàn diện',
    template: '%s | Sàn Xây Dựng',
  },
  description:
    'Nền tảng B2B kết nối nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư ngành xây dựng Việt Nam.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <IconSprite />

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
            <div className="nav-menu-wrap">
              <nav className="menu">
                <a href="/" className="active">Trang chủ</a>
                <a href="/directory">Tìm nhà thầu</a>
                <a href="/directory?group=crew">Tìm đội thi công</a>
                <a href="/directory?group=supplier">Nhà cung cấp</a>
                <a href="/marketplace">Nhu cầu</a>
              </nav>
              <div className="nav-actions">
                <a className="btn btn-ghost" href="/login">Đăng nhập</a>
                <a className="btn btn-orange" href="/login">Đăng ký</a>
              </div>
            </div>
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
                  <li><a href="/marketplace">Nhu cầu</a></li>
                </ul>
              </div>
              <div>
                <h4>Hỗ trợ</h4>
                <ul>
                  <li><a href="#">Hướng dẫn sử dụng</a></li>
                  <li><a href="#">Bảng giá</a></li>
                  <li><a href="#">Câu hỏi thường gặp</a></li>
                  <li><a href="#">Liên hệ</a></li>
                </ul>
              </div>
              <div>
                <h4>Liên hệ</h4>
                <ul>
                  <li><svg className="ic"><use href="#ic-phone" /></svg> 1900 xxxx</li>
                  <li><svg className="ic"><use href="#ic-mail" /></svg> hotro@sanxaydung.vn</li>
                  <li><svg className="ic"><use href="#ic-pin" /></svg> Hà Nội, Việt Nam</li>
                </ul>
              </div>
            </div>
            <div className="foot-bottom">© 2026 Sàn Xây Dựng. Bản quyền thuộc về nền tảng Sàn Xây Dựng.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
