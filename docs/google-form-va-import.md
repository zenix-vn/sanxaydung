# Google Form thu thập đối tác + Import vào Supabase

Tài liệu vận hành cho đợt thu thập thông tin 600 đối tác qua Zalo.
Liên quan: [Thiết kế kỹ thuật](./thiet-ke-ky-thuat.md) · migration `supabase/migrations/…_partner_registrations.sql` · script `scripts/import-registrations.mjs`.

---

## 1. Cấu hình Google Form (bắt buộc)

- **Settings → Responses:** bật **"Collect email addresses" = Verified** và **"Limit to 1 response" = ON** (đây là lớp lọc khai ảo bằng Gmail).
- **Response validation** cho các trường khóa:
  - MST — Regex: `^[0-9]{10}(-[0-9]{3})?$` — **KHÔNG đặt Required** (đội thi công/cá nhân có thể không có MST; regex chỉ kiểm khi có nhập).
  - SĐT — Regex: `^(0|\+84)[0-9]{9}$` — **Required** (là khóa chống trùng chính khi MST trống).

## 2. Mục chọn — dán thẳng vào Form

### Câu 6 — Nhóm lĩnh vực *(Multiple choice)*
```
Nhà thầu
Đội thi công
Nhà cung cấp
Đơn vị dịch vụ
```

### Câu 7 — Lĩnh vực chi tiết *(Checkboxes)*
```
Tổng thầu
Nhà thầu phụ
Nhà thầu chuyên ngành
Đội xây
Đội điện
Đội nước
Đội sơn
Đội hoàn thiện
Đội nhôm kính
Đội nội thất
Vật liệu xây dựng
Máy móc
Thiết bị
Nội thất
Thiết kế
Giám sát
Khảo sát
Xin phép xây dựng
Kiểm định
Cho thuê thiết bị
```

### Câu 8 — Tỉnh/thành hoạt động *(Checkboxes hoặc Dropdown)*
> Danh sách **34 đơn vị hành chính** sau sắp xếp 2025. Nếu đối tác quen tên tỉnh cũ, bạn có thể ghi chú tên mới tương ứng. Script import khớp theo **tên** nên bạn chỉnh danh sách tùy ý.
```
Hà Nội
TP. Hồ Chí Minh
Hải Phòng
Đà Nẵng
Cần Thơ
Huế
Quảng Ninh
Cao Bằng
Lạng Sơn
Lai Châu
Điện Biên
Sơn La
Thái Nguyên
Phú Thọ
Bắc Ninh
Hưng Yên
Ninh Bình
Lào Cai
Tuyên Quang
Thanh Hóa
Nghệ An
Hà Tĩnh
Quảng Trị
Quảng Ngãi
Gia Lai
Khánh Hòa
Lâm Đồng
Đắk Lắk
Đồng Nai
Tây Ninh
Vĩnh Long
Đồng Tháp
An Giang
Cà Mau
```

### Câu 5 — Quy mô nhân sự *(Multiple choice)*
```
1-10
11-50
51-200
trên 200
```

### Câu 15 — Chứng chỉ năng lực *(Multiple choice)*
```
Không có
Hạng III
Hạng II
Hạng I
```

## 3. Cấu trúc Google Sheet (tab "Form Responses 1")

Google Form tự sinh các cột theo đúng câu hỏi. Script import **dò cột theo từ khóa** trong tiêu đề (không cần đặt tên chính xác), map như sau:

| Cột trong Sheet (chứa từ khóa) | Trường DB | Ghi chú |
|--------------------------------|-----------|---------|
| `Email` / `Địa chỉ email` | `payload.email_google` | email Google đã xác thực |
| `Tên doanh nghiệp` | `company_name` | |
| `Mã số thuế` | `tax_code` | **có thể để trống**; chống trùng nếu có (nhiều bản trống không xung đột) |
| `pháp lý` | `legal_name` | |
| `Năm thành lập` | `founded_year` | |
| `Quy mô` | `size_range` | |
| `Nhóm lĩnh vực` | `group_key` | map nhãn → contractor/crew/supplier/service |
| `Lĩnh vực chi tiết` | `category_slugs[]` | tách theo dấu phẩy → slug |
| `Tỉnh` | `province_codes[]` | khớp tên → mã tỉnh |
| `Địa chỉ` | `address` | |
| `Người liên hệ` | `contact_name` | |
| `Chức vụ` | `contact_role` | |
| `điện thoại` | `phone` | **khóa chống trùng chính** (bắt buộc), chuẩn hóa +84→0 |
| `Website` | `website` | |
| `kinh nghiệm` | `payload.experience_years` | |
| `Chứng chỉ` | `capability_class` | |
| `Giới thiệu` | `intro` | |
| `Logo` | `logo_url` | link Drive |
| `ảnh công trình` | `payload.project_photos` | link Drive |

## 4. Quy trình import → duyệt → lên sàn

```
Google Form ──► Google Sheet ──(export CSV)──► scripts/import-registrations.mjs
   │                                                    │
   │                                       INSERT partner_registrations
   │                                       (UNIQUE tax_code/phone tự lọc trùng)
   ▼                                                    ▼
                                        status = 'pending'  ──► DUYỆT TAY
                                                                    │
                                              select promote_registration(id)
                                                                    ▼
                                        companies (published) + categories + locations
                                                    + compute_trust_score
```

### Chạy import
```bash
# 1) File → Download → CSV từ Google Sheet, lưu thành responses.csv
# 2) Đặt biến môi trường (lấy từ Supabase → Project Settings → API)
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role_key>"   # CHỈ chạy ở máy/CI, KHÔNG lộ ra client

cd scripts && npm install
node import-registrations.mjs ../responses.csv            # thật
node import-registrations.mjs ../responses.csv --dry-run  # chỉ xem map, không ghi
```

Kết quả in ra: số bản **inserted / duplicate / error**. Bản trùng MST/phone tự bị đánh dấu, không phá dữ liệu.

### Duyệt & promote (trong SQL editor của Supabase)
```sql
-- xem hàng chờ duyệt
select id, company_name, tax_code, phone, group_key from partner_registrations where status='pending';

-- promote 1 bản đã kiểm tra
select public.promote_registration('<registration_id>');

-- hoặc promote hàng loạt sau khi đã lọc
select public.promote_registration(id) from partner_registrations where status='pending';
```
