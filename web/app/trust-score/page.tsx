import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Cách tính Trust Score' };

export default function Page() {
  return (
    <InfoPage title="Cách tính Trust Score" intro="Trust Score là thang điểm giúp bạn đánh giá nhanh mức độ tin cậy của một doanh nghiệp (hiện tối đa 75 điểm, gồm bốn thành phần bên dưới). Điểm được tính lại tự động mỗi khi dữ liệu thay đổi và hằng đêm.">
      <h2>Các thành phần</h2>
      <ul>
        <li><b>Xác minh pháp lý và năng lực (tối đa 20):</b> 14 điểm khi mã số thuế hoặc giấy phép kinh doanh được xác minh; 20 điểm khi có chứng chỉ năng lực được xác minh.</li>
        <li><b>Đánh giá từ đối tác (tối đa 30):</b> theo điểm trung bình các đánh giá đã công khai. Chỉ doanh nghiệp có kết nối hoàn tất mới được đánh giá.</li>
        <li><b>Số lượng dự án (tối đa 15):</b> mỗi dự án đã đăng được 2 điểm.</li>
        <li><b>Độ hoàn thiện hồ sơ (tối đa 10):</b> theo mức đầy đủ của thông tin (tên, giới thiệu, logo, ảnh bìa, liên hệ, địa chỉ, khu vực, năm thành lập, website).</li>
      </ul>
      <p>Các thành phần được cộng lại: 20 + 30 + 15 + 10 = tối đa 75 điểm.</p>
      <h2>Làm sao để tăng điểm?</h2>
      <ol>
        <li>Hoàn thiện hồ sơ doanh nghiệp.</li>
        <li><a href="/dashboard/verify">Gửi giấy tờ xác minh</a>.</li>
        <li>Đăng các dự án tiêu biểu.</li>
        <li>Hoàn tất hợp tác trên sàn để nhận đánh giá từ đối tác.</li>
      </ol>
    </InfoPage>
  );
}
