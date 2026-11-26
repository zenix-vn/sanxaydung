/** Nhãn tiếng Việt dùng chung trong trang quản trị. */
export const TIER: Record<string, { l: string; c: string }> = {
  none: { l: 'Chưa xác minh', c: '' }, legal: { l: 'Pháp lý', c: 'b' }, capability: { l: 'Năng lực', c: 'g' }, gold: { l: 'Đối tác vàng', c: 'o' },
};
export const VERIFY_KIND: Record<string, string> = { tax: 'Mã số thuế', business_license: 'Giấy phép kinh doanh', capability_cert: 'Chứng chỉ năng lực' };
export const GROUP_LABEL: Record<string, string> = { contractor: 'Nhà thầu', crew: 'Đội thi công', supplier: 'Nhà cung cấp', service: 'Dịch vụ' };
/** Lý do từ chối soạn sẵn (gửi kèm thông báo cho người dùng). */
export const REJECT_REASONS = {
  verification: ['Ảnh giấy tờ mờ hoặc thiếu trang', 'Mã số thuế không khớp tên doanh nghiệp', 'Giấy tờ đã hết hạn', 'Thiếu tài liệu minh chứng'],
  claim: ['Số điện thoại không khớp với hồ sơ', 'Chưa chứng minh được bạn là đại diện doanh nghiệp', 'Hồ sơ đã có người quản lý hợp lệ'],
  registration: ['Thông tin không đầy đủ', 'Không liên hệ được qua số điện thoại', 'Không thuộc lĩnh vực xây dựng', 'Nội dung quảng cáo hoặc spam'],
};
export const MEMBER_ROLE: Record<string, string> = { owner: 'Chủ sở hữu', admin: 'Quản trị công ty', editor: 'Biên tập viên', member: 'Thành viên' };
export const AD_SLOTS: Record<string, string> = { home_banner: 'Trang chủ', directory_top: 'Đầu danh bạ', marketplace_top: 'Đầu trang Nhu cầu & Báo giá' };
export const AUDIT_LABEL: Record<string, string> = {
  'verification.approved': 'Duyệt xác minh', 'verification.rejected': 'Từ chối xác minh',
  'company.claim_approved': 'Duyệt claim hồ sơ', 'company.claim_rejected': 'Từ chối claim hồ sơ',
  'company.claim': 'Chủ doanh nghiệp tự nhận hồ sơ', 'company.create': 'Tạo hồ sơ doanh nghiệp',
  'company.status_suspended': 'Đình chỉ doanh nghiệp', 'company.status_published': 'Công khai doanh nghiệp', 'company.status_draft': 'Chuyển nháp',
  'company.tier_none': 'Gỡ hạng xác minh', 'company.tier_legal': 'Đặt hạng Pháp lý', 'company.tier_capability': 'Đặt hạng Năng lực', 'company.tier_gold': 'Cấp Đối tác vàng',
  'company.admin_update': 'Quản trị sửa thông tin hồ sơ', 'company.owner_changed': 'Đổi chủ sở hữu', 'company.member_removed': 'Gỡ thành viên', 'company.merged': 'Gộp hồ sơ trùng',
  'moderation.hide': 'Ẩn nội dung', 'moderation.restore': 'Khôi phục nội dung',
  'subscription.granted': 'Cấp gói', 'subscription.cancelled': 'Hủy gói',
  'report.resolved': 'Đóng báo cáo (đã xử lý)', 'report.dismissed': 'Bỏ qua báo cáo', 'report.reviewing': 'Đang xem báo cáo',
  'registration.approve': 'Duyệt đăng ký đối tác', 'registration.reject': 'Từ chối đăng ký', 'registration.duplicate': 'Đánh dấu đăng ký trùng',
  'account.delete_self': 'Người dùng tự xóa tài khoản',
  'user.role_owner': 'Cấp quyền Chủ sở hữu', 'user.role_admin': 'Cấp quyền Quản trị viên', 'user.role_moderator': 'Cấp quyền Kiểm duyệt viên', 'user.role_member': 'Thu hồi quyền quản trị',
  'payment.recorded': 'Ghi nhận thanh toán', 'payment.voided': 'Hủy phiếu thu', 'subscription.reminded': 'Nhắc gia hạn gói',
  'plan.updated': 'Sửa bảng giá', 'listing.invited': 'Mời báo giá',
  'category.created': 'Thêm danh mục', 'category.updated': 'Sửa danh mục', 'category.merged': 'Gộp danh mục', 'category.deleted': 'Xóa danh mục',
  'province.renamed': 'Đổi tên tỉnh/thành', 'moderation.review_cleared': 'Xác nhận đánh giá hợp lệ',
  'ad.created': 'Thêm quảng cáo', 'ad.updated': 'Sửa quảng cáo', 'ad.active': 'Bật quảng cáo', 'ad.paused': 'Tạm dừng quảng cáo', 'ad.deleted': 'Xóa quảng cáo',
  'broadcast.sent': 'Gửi thông báo hàng loạt',
  'import.partners': 'Nhập doanh nghiệp từ CSV', 'export.csv': 'Xuất dữ liệu CSV',
  'user.signed_out': 'Đăng xuất mọi thiết bị', 'user.viewed_as': 'Xem như người dùng',
  'user.banned': 'Khóa tài khoản', 'user.unbanned': 'Mở khóa tài khoản',
};
