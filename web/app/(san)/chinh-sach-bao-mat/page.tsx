import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Chính sách bảo mật' };

export default function Page() {
  return (
    <InfoPage title="Chính sách bảo mật" intro="Cập nhật lần cuối: 19/11/2026. Chính sách này giải thích cách Sàn Xây Dựng xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.">
      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <ul>
        <li><b>Tài khoản:</b> họ tên, email, ảnh đại diện từ Google khi bạn đăng nhập.</li>
        <li><b>Hồ sơ doanh nghiệp:</b> tên, mã số thuế, địa chỉ, số điện thoại, người liên hệ, lĩnh vực, dự án, tài liệu năng lực do bạn hoặc doanh nghiệp cung cấp.</li>
        <li><b>Hoạt động:</b> tin nhắn, báo giá, bài đăng, đánh giá, thông báo và nhật ký thao tác cần thiết cho bảo mật.</li>
      </ul>
      <h2>2. Mục đích sử dụng</h2>
      <p>Vận hành nền tảng, kết nối doanh nghiệp, xác minh hồ sơ, tính điểm tin cậy, gửi thông báo, phòng chống gian lận và tuân thủ quy định pháp luật.</p>
      <h2>3. Thông tin hiển thị công khai</h2>
      <p>Tên doanh nghiệp, lĩnh vực, khu vực, giới thiệu, website, dự án và đánh giá được hiển thị công khai. Mã số thuế được che một phần. Tài liệu xác minh, tin nhắn và email cá nhân <b>không</b> công khai.</p>
      <h2>4. Chia sẻ dữ liệu</h2>
      <p>Chúng tôi không bán dữ liệu cá nhân. Dữ liệu chỉ chia sẻ với nhà cung cấp hạ tầng/dịch vụ (lưu trữ, gửi email, đăng nhập Google) hoặc cơ quan có thẩm quyền khi pháp luật yêu cầu.</p>
      <h2>5. Quyền của bạn</h2>
      <ul>
        <li>Xem, tải xuống toàn bộ dữ liệu cá nhân và xóa tài khoản trong <a href="/dashboard/settings">Cài đặt</a>.</li>
        <li>Yêu cầu chỉnh sửa hoặc gỡ hồ sơ doanh nghiệp qua <a href="/lien-he">trang liên hệ</a>.</li>
        <li>Rút lại sự đồng ý bất cứ lúc nào; việc này không ảnh hưởng tới xử lý đã thực hiện trước đó.</li>
      </ul>
      <h2>6. Bảo mật và lưu trữ</h2>
      <p>Dữ liệu truyền qua HTTPS, phân quyền truy cập theo từng dòng dữ liệu, tài liệu xác minh lưu ở kho riêng tư. Dữ liệu được lưu trong thời gian tài khoản còn hoạt động và theo thời hạn pháp luật yêu cầu.</p>
      <h2>7. Cookie</h2>
      <p>Chúng tôi dùng cookie phiên cần thiết để duy trì đăng nhập; không dùng cookie quảng cáo của bên thứ ba.</p>
    </InfoPage>
  );
}
