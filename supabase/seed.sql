-- =============================================================
-- seed.sql — dữ liệu tham chiếu (chạy sau migrations qua `supabase db reset`)
-- =============================================================

-- ---------- Gói thành viên ----------
insert into public.plans (id, name, price_month, features) values
  ('free',        'Free',        0,        '{"listings":3,"featured":0,"analytics":false}'),
  ('professional','Professional',499000,   '{"listings":30,"featured":5,"analytics":true}'),
  ('enterprise',  'Enterprise',  1990000,  '{"listings":-1,"featured":50,"analytics":true,"api":true}')
on conflict (id) do nothing;

-- ---------- Tỉnh/thành: 34 đơn vị hành chính sau sắp xếp 2025 ----------
insert into public.provinces (code, name) values
  ('01','Hà Nội'), ('79','TP. Hồ Chí Minh'), ('31','Hải Phòng'), ('48','Đà Nẵng'),
  ('92','Cần Thơ'), ('46','Huế'), ('22','Quảng Ninh'), ('04','Cao Bằng'),
  ('20','Lạng Sơn'), ('12','Lai Châu'), ('11','Điện Biên'), ('14','Sơn La'),
  ('19','Thái Nguyên'), ('25','Phú Thọ'), ('27','Bắc Ninh'), ('33','Hưng Yên'),
  ('37','Ninh Bình'), ('10','Lào Cai'), ('08','Tuyên Quang'), ('38','Thanh Hóa'),
  ('40','Nghệ An'), ('42','Hà Tĩnh'), ('45','Quảng Trị'), ('51','Quảng Ngãi'),
  ('64','Gia Lai'), ('56','Khánh Hòa'), ('68','Lâm Đồng'), ('66','Đắk Lắk'),
  ('75','Đồng Nai'), ('72','Tây Ninh'), ('86','Vĩnh Long'), ('87','Đồng Tháp'),
  ('89','An Giang'), ('96','Cà Mau')
on conflict (code) do nothing;

-- ---------- Danh mục lĩnh vực (theo đề án) ----------
-- Nhóm chính (parent)
insert into public.categories (id, parent_id, group_key, slug, name, sort_order) values
  ('11111111-0000-0000-0000-000000000001', null, 'contractor', 'nha-thau',    'Nhà thầu xây dựng', 1),
  ('11111111-0000-0000-0000-000000000002', null, 'crew',       'doi-thi-cong','Đội thi công',       2),
  ('11111111-0000-0000-0000-000000000003', null, 'supplier',   'nha-cung-cap','Nhà cung cấp',       3),
  ('11111111-0000-0000-0000-000000000004', null, 'service',    'dich-vu',     'Đơn vị dịch vụ',     4)
on conflict (id) do nothing;

-- Con của Nhà thầu
insert into public.categories (parent_id, group_key, slug, name, sort_order) values
  ('11111111-0000-0000-0000-000000000001','contractor','tong-thau',        'Tổng thầu',              1),
  ('11111111-0000-0000-0000-000000000001','contractor','nha-thau-phu',     'Nhà thầu phụ',           2),
  ('11111111-0000-0000-0000-000000000001','contractor','nha-thau-chuyen',  'Nhà thầu chuyên ngành',  3)
on conflict (slug) do nothing;

-- Con của Đội thi công
insert into public.categories (parent_id, group_key, slug, name, sort_order) values
  ('11111111-0000-0000-0000-000000000002','crew','doi-xay',        'Đội xây',        1),
  ('11111111-0000-0000-0000-000000000002','crew','doi-dien',       'Đội điện',       2),
  ('11111111-0000-0000-0000-000000000002','crew','doi-nuoc',       'Đội nước',       3),
  ('11111111-0000-0000-0000-000000000002','crew','doi-son',        'Đội sơn',        4),
  ('11111111-0000-0000-0000-000000000002','crew','doi-hoan-thien', 'Đội hoàn thiện', 5),
  ('11111111-0000-0000-0000-000000000002','crew','doi-nhom-kinh',  'Đội nhôm kính',  6),
  ('11111111-0000-0000-0000-000000000002','crew','doi-noi-that',   'Đội nội thất',   7)
on conflict (slug) do nothing;

-- Con của Nhà cung cấp
insert into public.categories (parent_id, group_key, slug, name, sort_order) values
  ('11111111-0000-0000-0000-000000000003','supplier','vat-lieu',  'Vật liệu xây dựng', 1),
  ('11111111-0000-0000-0000-000000000003','supplier','may-moc',   'Máy móc',           2),
  ('11111111-0000-0000-0000-000000000003','supplier','thiet-bi',  'Thiết bị',          3),
  ('11111111-0000-0000-0000-000000000003','supplier','noi-that',  'Nội thất',          4)
on conflict (slug) do nothing;

-- Con của Dịch vụ
insert into public.categories (parent_id, group_key, slug, name, sort_order) values
  ('11111111-0000-0000-0000-000000000004','service','thiet-ke',        'Thiết kế',            1),
  ('11111111-0000-0000-0000-000000000004','service','giam-sat',        'Giám sát',            2),
  ('11111111-0000-0000-0000-000000000004','service','khao-sat',        'Khảo sát',            3),
  ('11111111-0000-0000-0000-000000000004','service','xin-phep',        'Xin phép xây dựng',   4),
  ('11111111-0000-0000-0000-000000000004','service','kiem-dinh',       'Kiểm định',           5),
  ('11111111-0000-0000-0000-000000000004','service','cho-thue-thiet-bi','Cho thuê thiết bị',  6)
on conflict (slug) do nothing;
