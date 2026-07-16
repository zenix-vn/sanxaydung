/**
 * Tạo Google Form "Đăng ký hồ sơ đối tác — Sàn Xây Dựng" bằng Apps Script.
 *
 * CÁCH DÙNG:
 *   1. Mở https://script.google.com  ->  New project
 *   2. Dán toàn bộ file này vào, Save
 *   3. Chọn hàm createPartnerForm  ->  Run  (cấp quyền lần đầu)
 *   4. Xem Execution log: in ra link Form (edit) và link trả lời
 *   5. Trong Form: Responses -> tạo/liên kết Google Sheet (để import)
 *
 * GHI CHÚ:
 *   - Google Apps Script KHÔNG tạo được câu hỏi "Tải tệp lên" (file upload).
 *     -> Logo/ảnh công trình dùng ô nhập "link Google Drive" thay thế.
 *   - MST KHÔNG bắt buộc; SĐT bắt buộc (khóa chống trùng chính).
 */

// ---------- Danh sách mục chọn (chỉnh tại đây nếu cần) ----------
var GROUPS = ['Nhà thầu', 'Đội thi công', 'Nhà cung cấp', 'Đơn vị dịch vụ'];

var CATEGORIES = [
  'Tổng thầu', 'Nhà thầu phụ', 'Nhà thầu chuyên ngành',
  'Đội xây', 'Đội điện', 'Đội nước', 'Đội sơn', 'Đội hoàn thiện', 'Đội nhôm kính', 'Đội nội thất',
  'Vật liệu xây dựng', 'Máy móc', 'Thiết bị', 'Nội thất',
  'Thiết kế', 'Giám sát', 'Khảo sát', 'Xin phép xây dựng', 'Kiểm định', 'Cho thuê thiết bị'
];

var PROVINCES = [
  'Hà Nội', 'TP. Hồ Chí Minh', 'Hải Phòng', 'Đà Nẵng', 'Cần Thơ', 'Huế', 'Quảng Ninh',
  'Cao Bằng', 'Lạng Sơn', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Thái Nguyên', 'Phú Thọ',
  'Bắc Ninh', 'Hưng Yên', 'Ninh Bình', 'Lào Cai', 'Tuyên Quang', 'Thanh Hóa', 'Nghệ An',
  'Hà Tĩnh', 'Quảng Trị', 'Quảng Ngãi', 'Gia Lai', 'Khánh Hòa', 'Lâm Đồng', 'Đắk Lắk',
  'Đồng Nai', 'Tây Ninh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Cà Mau'
];

var SIZES = ['1-10', '11-50', '51-200', 'trên 200'];
var CAP_CLASSES = ['Không có', 'Hạng III', 'Hạng II', 'Hạng I'];

function createPartnerForm() {
  var form = FormApp.create('Đăng ký hồ sơ đối tác — Sàn Xây Dựng');
  form.setDescription(
    'Thông tin dùng để tạo hồ sơ năng lực của doanh nghiệp bạn trên Sàn Xây Dựng. ' +
    'Vui lòng khai chính xác — mỗi doanh nghiệp khai 1 lần.'
  );
  form.setCollectEmail(true);            // bắt đăng nhập Google -> lọc khai ảo
  form.setLimitOneResponsePerUser(true); // 1 phản hồi / tài khoản Google

  // Validation dùng lại
  var vMST = FormApp.createTextValidation()
    .setHelpText('MST gồm 10 hoặc 13 số (có thể để trống nếu không có).')
    .requireTextMatchesPattern('^[0-9]{10}(-[0-9]{3})?$').build();
  var vPhone = FormApp.createTextValidation()
    .setHelpText('SĐT gồm 10 số, ví dụ 0901234567 hoặc +84901234567.')
    .requireTextMatchesPattern('^(0|\\+84)[0-9]{9}$').build();

  // ----- Phần A: Doanh nghiệp -----
  form.addSectionHeaderItem().setTitle('A. Thông tin doanh nghiệp');
  form.addTextItem().setTitle('Tên doanh nghiệp').setRequired(true);
  form.addTextItem().setTitle('Mã số thuế (MST)')
      .setHelpText('Có thể để trống nếu là đội thi công/cá nhân chưa có MST.')
      .setValidation(vMST).setRequired(false);
  form.addTextItem().setTitle('Tên pháp lý đầy đủ');
  form.addTextItem().setTitle('Năm thành lập');
  form.addMultipleChoiceItem().setTitle('Quy mô nhân sự').setChoiceValues(SIZES);

  // ----- Phần B: Lĩnh vực & khu vực -----
  form.addSectionHeaderItem().setTitle('B. Lĩnh vực & khu vực hoạt động');
  form.addMultipleChoiceItem().setTitle('Nhóm lĩnh vực').setChoiceValues(GROUPS).setRequired(true);
  form.addCheckboxItem().setTitle('Lĩnh vực chi tiết').setChoiceValues(CATEGORIES).setRequired(true);
  form.addCheckboxItem().setTitle('Tỉnh/thành hoạt động').setChoiceValues(PROVINCES).setRequired(true);
  form.addTextItem().setTitle('Địa chỉ trụ sở');

  // ----- Phần C: Liên hệ -----
  form.addSectionHeaderItem().setTitle('C. Người liên hệ');
  form.addTextItem().setTitle('Người liên hệ (Họ tên)').setRequired(true);
  form.addTextItem().setTitle('Chức vụ');
  form.addTextItem().setTitle('Số điện thoại')
      .setHelpText('Bắt buộc — dùng để xác nhận và chống khai trùng.')
      .setValidation(vPhone).setRequired(true);
  form.addTextItem().setTitle('Website / Fanpage');

  // ----- Phần D: Năng lực & minh chứng -----
  form.addSectionHeaderItem().setTitle('D. Năng lực & minh chứng (tùy chọn)');
  form.addTextItem().setTitle('Số năm kinh nghiệm');
  form.addMultipleChoiceItem().setTitle('Chứng chỉ năng lực').setChoiceValues(CAP_CLASSES);
  form.addParagraphTextItem().setTitle('Giới thiệu ngắn (1-2 câu)');
  form.addTextItem().setTitle('Logo công ty (link Google Drive)')
      .setHelpText('Tải logo lên Google Drive, đặt chia sẻ "Ai có link", rồi dán link vào đây.');
  form.addTextItem().setTitle('Ảnh công trình tiêu biểu (link Google Drive)');

  // ----- Phần E: Cam kết -----
  form.addSectionHeaderItem().setTitle('E. Cam kết');
  form.addCheckboxItem().setTitle('Đồng ý & Cam kết').setRequired(true).setChoiceValues([
    'Tôi đồng ý cho Sàn Xây Dựng thu thập & hiển thị thông tin này (Nghị định 13/2023/NĐ-CP)',
    'Tôi cam kết thông tin khai là chính xác và chịu trách nhiệm'
  ]);

  Logger.log('✅ Form đã tạo.');
  Logger.log('Sửa form:  ' + form.getEditUrl());
  Logger.log('Gửi cho đối tác (link khai): ' + form.getPublishedUrl());
}
