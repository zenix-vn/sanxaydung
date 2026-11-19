import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Điều khoản sử dụng' };

export default function Page() {
  return (
    <InfoPage title="Điều khoản sử dụng" intro="Cập nhật lần cuối: 19/11/2026. Khi truy cập hoặc đăng nhập Sàn Xây Dựng, bạn đồng ý với các điều khoản dưới đây.">
      <h2>1. Về dịch vụ</h2>
      <p>Sàn Xây Dựng là nền tảng trực tuyến kết nối nhà thầu, đội thi công, nhà cung cấp và chủ đầu tư trong ngành xây dựng. Chúng tôi cung cấp hồ sơ năng lực, đăng nhu cầu/báo giá, nhắn tin, đánh giá và điểm tin cậy (Trust Score). Sàn là bên trung gian kết nối, không phải một bên của hợp đồng giữa các doanh nghiệp.</p>
      <h2>2. Tài khoản</h2>
      <ul>
        <li>Đăng nhập bằng tài khoản Google. Bạn chịu trách nhiệm về mọi hoạt động từ tài khoản của mình.</li>
        <li>Chỉ người có thẩm quyền đại diện doanh nghiệp mới được nhận quyền quản lý hồ sơ doanh nghiệp đó.</li>
      </ul>
      <h2>3. Thông tin doanh nghiệp</h2>
      <ul>
        <li>Bạn cam kết thông tin khai báo (tên, mã số thuế, địa chỉ, năng lực, dự án…) là chính xác và cập nhật.</li>
        <li>Huy hiệu xác minh chỉ được cấp sau khi đội ngũ kiểm tra giấy tờ. Chúng tôi có quyền thu hồi huy hiệu nếu phát hiện sai lệch.</li>
        <li>Hồ sơ chưa được chủ sở hữu nhận được tạo từ thông tin doanh nghiệp tự nguyện cung cấp; chủ doanh nghiệp có thể yêu cầu chỉnh sửa hoặc gỡ bất cứ lúc nào.</li>
      </ul>
      <h2>4. Đánh giá và Trust Score</h2>
      <p>Chỉ doanh nghiệp có kết nối đã hoàn tất trên sàn mới được đánh giá nhau. Nghiêm cấm đánh giá khống, mua bán đánh giá hoặc thao túng điểm. Xem thêm <a href="/trust-score">cách tính Trust Score</a>.</p>
      <h2>5. Hành vi bị cấm</h2>
      <ul>
        <li>Mạo danh doanh nghiệp/cá nhân, đăng thông tin sai sự thật hoặc lừa đảo.</li>
        <li>Đăng nội dung vi phạm pháp luật, xúc phạm, spam hoặc xâm phạm quyền sở hữu trí tuệ.</li>
        <li>Thu thập dữ liệu hàng loạt, can thiệp hệ thống hoặc truy cập trái phép.</li>
      </ul>
      <h2>6. Xử lý vi phạm</h2>
      <p>Chúng tôi có quyền ẩn nội dung, tạm khóa hoặc chấm dứt tài khoản vi phạm. Bạn có thể báo cáo nội dung vi phạm bằng nút “Báo cáo” trên trang hồ sơ.</p>
      <h2>7. Giới hạn trách nhiệm</h2>
      <p>Sàn không bảo đảm kết quả giao dịch giữa các doanh nghiệp. Bạn tự thẩm định đối tác trước khi hợp tác. Dịch vụ được cung cấp “nguyên trạng” và có thể gián đoạn để bảo trì.</p>
      <h2>8. Thay đổi và liên hệ</h2>
      <p>Điều khoản có thể được cập nhật; việc tiếp tục sử dụng đồng nghĩa với việc chấp nhận bản mới. Câu hỏi xin gửi tới <a href="/lien-he">trang liên hệ</a>.</p>
    </InfoPage>
  );
}
