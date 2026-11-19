import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Hướng dẫn sử dụng' };

export default function Page() {
  return (
    <InfoPage title="Hướng dẫn sử dụng" intro="Các bước để bắt đầu và tận dụng Sàn Xây Dựng.">
      <h2>1. Đăng nhập</h2>
      <p>Vào <a href="/login">trang đăng nhập</a> và chọn “Tiếp tục với Google”.</p>
      <h2>2. Nhận hoặc tạo hồ sơ doanh nghiệp</h2>
      <ul>
        <li>Nếu doanh nghiệp đã có hồ sơ trên sàn: vào <a href="/dashboard/claim">Nhận hồ sơ</a>. Đăng nhập bằng đúng email đã dùng khi đăng ký thì nhận được ngay; trường hợp khác sẽ được đội ngũ duyệt.</li>
        <li>Nếu chưa có: chọn <a href="/dashboard/new">Tạo công ty mới</a>.</li>
      </ul>
      <h2>3. Hoàn thiện hồ sơ</h2>
      <p>Trong <a href="/dashboard/company-edit">Chỉnh sửa hồ sơ</a>, bổ sung logo, giới thiệu, địa chỉ, lĩnh vực, khu vực và dự án. Hồ sơ càng đầy đủ, điểm tin cậy càng cao.</p>
      <h2>4. Xác minh</h2>
      <p>Gửi mã số thuế, giấy phép kinh doanh hoặc chứng chỉ năng lực tại <a href="/dashboard/verify">Xác minh</a> để nhận huy hiệu Verified.</p>
      <h2>5. Tìm đối tác và nhận báo giá</h2>
      <ul>
        <li>Dùng <a href="/directory">Danh bạ</a> để lọc theo lĩnh vực, khu vực và mức xác minh.</li>
        <li>Đăng nhu cầu tại <a href="/marketplace/new">Đăng tin</a>; đối tác sẽ gửi báo giá để bạn chọn.</li>
      </ul>
      <h2>6. Kết nối và đánh giá</h2>
      <p>Nhắn tin trực tiếp trong <a href="/chat">Tin nhắn</a>. Sau khi hợp tác hoàn tất, hai bên xác nhận kết nối và có thể đánh giá lẫn nhau.</p>
      <p>Cần hỗ trợ thêm? Xem <a href="/cau-hoi-thuong-gap">Câu hỏi thường gặp</a> hoặc <a href="/lien-he">liên hệ</a>.</p>
    </InfoPage>
  );
}
