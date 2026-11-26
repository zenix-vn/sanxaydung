import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = { title: 'Câu hỏi thường gặp' };

const FAQ: [string, string][] = [
  ['Đăng ký có mất phí không?', 'Không. Sàn Xây Dựng hoàn toàn miễn phí: tạo hồ sơ, xác minh doanh nghiệp, đăng nhu cầu, nhận báo giá, nhắn tin và đánh giá đối tác đều không mất phí.'],
  ['Hồ sơ doanh nghiệp của tôi đã có trên sàn, tôi nhận lại thế nào?', 'Đăng nhập Google bằng đúng email bạn đã dùng khi điền form đăng ký, vào mục Nhận hồ sơ để nhận ngay. Nếu email khác, gửi yêu cầu để đội ngũ duyệt thủ công.'],
  ['Doanh nghiệp không có mã số thuế có đăng ký được không?', 'Được. Mã số thuế không bắt buộc (ví dụ đội thi công nhỏ, cá nhân); số điện thoại là thông tin định danh chính. Có mã số thuế sẽ giúp bạn được xác minh và tăng điểm tin cậy.'],
  ['Huy hiệu Verified lấy thế nào?', 'Gửi mã số thuế, giấy phép kinh doanh hoặc chứng chỉ năng lực trong mục Xác minh. Sau khi đội ngũ kiểm tra hợp lệ, huy hiệu sẽ được cấp và điểm tin cậy tự cập nhật.'],
  ['Trust Score là gì?', 'Là thang điểm (hiện tối đa 75) phản ánh mức độ tin cậy của doanh nghiệp, dựa trên xác minh pháp lý, đánh giá từ đối tác, số dự án và độ hoàn thiện hồ sơ. Chi tiết tại trang Cách tính Trust Score.'],
  ['Ai được đánh giá doanh nghiệp?', 'Chỉ doanh nghiệp đã có kết nối hoàn tất với bên được đánh giá trên sàn, nhằm chống đánh giá ảo.'],
  ['Tôi muốn xóa tài khoản hoặc dữ liệu của mình?', 'Vào Bảng điều khiển → Cài đặt để tải dữ liệu hoặc xóa tài khoản. Muốn gỡ hồ sơ doanh nghiệp, hãy liên hệ chúng tôi.'],
  ['Tôi phát hiện thông tin sai hoặc nội dung vi phạm?', 'Bấm “Báo cáo” trên trang hồ sơ liên quan. Đội ngũ sẽ xem xét và xử lý.'],
];

export default function Page() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (
    <InfoPage title="Câu hỏi thường gặp">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {FAQ.map(([q, a]) => (
        <details key={q}><summary>{q}</summary><p>{a}</p></details>
      ))}
    </InfoPage>
  );
}
