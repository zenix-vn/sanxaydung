import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Liên hệ' };

export default function Page() {
  return (
    <InfoPage title="Liên hệ" intro="Chúng tôi luôn sẵn sàng hỗ trợ doanh nghiệp.">
      <h2>Email hỗ trợ</h2>
      <p><a href="mailto:hotro@sanxaydung.vn">hotro@sanxaydung.vn</a></p>
      <h2>Địa chỉ</h2>
      <p>Hà Nội, Việt Nam</p>
      <h2>Bạn cần gì?</h2>
      <ul>
        <li>Nhận hồ sơ doanh nghiệp không khớp email: gửi tên doanh nghiệp, số điện thoại và email Google đã đăng nhập.</li>
        <li>Yêu cầu chỉnh sửa hoặc gỡ thông tin: nêu rõ hồ sơ và nội dung cần thay đổi.</li>
        <li>Báo lỗi hoặc đề xuất tính năng: mô tả các bước thực hiện và ảnh chụp màn hình nếu có.</li>
      </ul>
    </InfoPage>
  );
}
