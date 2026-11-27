import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Không tìm thấy trang', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="errpage">
      <div className="code">404</div>
      <h1>Không tìm thấy trang</h1>
      <p>Trang bạn tìm có thể đã bị xóa, đổi địa chỉ hoặc hồ sơ doanh nghiệp chưa được xuất bản.</p>
      <div className="row">
        <a className="btn btn-orange" href="/directory"><svg className="ic"><use href="#ic-search" /></svg> Tìm doanh nghiệp</a>
        <a className="btn btn-outline" href="/marketplace">Xem nhu cầu đang mở</a>
        <a className="btn btn-outline" href="/">Về trang chủ</a>
      </div>
    </div>
  );
}
