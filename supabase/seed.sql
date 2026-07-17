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

-- =============================================================
-- Doanh nghiệp thật (thông tin công khai) — hồ sơ "chưa có chủ" (owner_id NULL)
-- Đây là dữ liệu cold-start; đối tác sẽ claim & cập nhật sau (xem docs onboarding).
-- =============================================================
insert into public.companies (slug,name,legal_name,intro,website,province_code,founded_year,size_range,status,verified_tier,profile_completeness) values
 ('coteccons','Coteccons','Công ty CP Xây dựng Coteccons','Tổng thầu xây dựng dân dụng & công nghiệp hàng đầu Việt Nam.','coteccons.vn','79',2004,'trên 200','published','capability',90),
 ('hoa-binh-hbc','Tập đoàn Xây dựng Hòa Bình','Công ty CP Tập đoàn Xây dựng Hòa Bình','Tổng thầu thi công công trình dân dụng và hạ tầng.','hbcg.vn','79',1987,'trên 200','published','capability',88),
 ('vinaconex','Vinaconex','Tổng CT CP Xuất nhập khẩu và Xây dựng Việt Nam','Xây dựng hạ tầng, dân dụng và bất động sản.','vinaconex.com.vn','01',1988,'trên 200','published','capability',85),
 ('ricons','Ricons','Công ty CP Đầu tư Xây dựng Ricons','Tổng thầu thiết kế - thi công (Design & Build).','ricons.vn','79',2004,'trên 200','published','legal',80),
 ('newtecons','Newtecons','Công ty CP Đầu tư Xây dựng Newtecons','Tổng thầu công trình dân dụng & công nghiệp.','newtecons.vn','79',2003,'trên 200','published','legal',80),
 ('delta-group','Tập đoàn Delta','Công ty CP Tập đoàn Delta','Thi công nền móng, tầng hầm và kết cấu công trình.','delta.com.vn','01',1993,'51-200','published','legal',78),
 ('cofico','Cofico','Công ty CP Xây dựng số 1 (Cofico)','Tổng thầu xây dựng dân dụng & công nghiệp.','cofico.com.vn','79',1978,'trên 200','published','legal',80),
 ('fecon','FECON','Công ty CP FECON','Nền móng và công trình ngầm.','fecon.com.vn','01',2004,'trên 200','published','capability',82),
 ('an-phong-construction','An Phong Construction','Công ty CP Xây dựng An Phong','Thi công hoàn thiện và cơ điện công trình.','anphongcons.com','79',2005,'51-200','published','legal',75),
 ('unicons','Unicons','Công ty TNHH Unicons','Tổng thầu thi công xây dựng.','unicons.vn','79',2006,'trên 200','published','legal',78),
 ('central-cons','Central Construction','Công ty CP Xây dựng Central','Tổng thầu công trình dân dụng.','central.com.vn','79',2017,'51-200','published','none',60),
 ('phuc-hung-holdings','Phục Hưng Holdings','Công ty CP Xây dựng Phục Hưng Holdings','Tổng thầu xây dựng và hạ tầng.','phuchunghdc.com','01',2001,'51-200','published','none',60),
 ('viglacera','Viglacera','Tổng CT Viglacera - CTCP','Vật liệu xây dựng: gạch, kính, sứ vệ sinh.','viglacera.com.vn','01',1974,'trên 200','published','capability',85),
 ('hoa-sen-group','Tập đoàn Hoa Sen','Công ty CP Tập đoàn Hoa Sen','Tôn, thép và vật liệu xây dựng.','hoasengroup.vn','79',2001,'trên 200','published','legal',80),
 ('vncc','VNCC','Tổng CT Tư vấn Xây dựng Việt Nam - CTCP','Tư vấn thiết kế, khảo sát và giám sát xây dựng.','vncc.vn','01',1955,'trên 200','published','legal',78)
on conflict (slug) do nothing;

-- Danh mục
insert into public.company_categories (company_id,category_id)
 select c.id, cat.id from public.companies c join public.categories cat on cat.slug='tong-thau'
 where c.slug in ('coteccons','hoa-binh-hbc','vinaconex','ricons','newtecons','delta-group','cofico','an-phong-construction','unicons','central-cons','phuc-hung-holdings')
 on conflict do nothing;
insert into public.company_categories (company_id,category_id)
 select c.id, cat.id from public.companies c join public.categories cat on cat.slug='nha-thau-chuyen' where c.slug='fecon' on conflict do nothing;
insert into public.company_categories (company_id,category_id)
 select c.id, cat.id from public.companies c join public.categories cat on cat.slug='vat-lieu' where c.slug in ('viglacera','hoa-sen-group') on conflict do nothing;
insert into public.company_categories (company_id,category_id)
 select c.id, cat.id from public.companies c join public.categories cat on cat.slug='thiet-ke' where c.slug='vncc' on conflict do nothing;

-- Khu vực (theo province_code của công ty)
insert into public.company_locations (company_id,province_code)
 select id, province_code from public.companies c where province_code is not null on conflict do nothing;

-- Xác minh (khớp verified_tier) — để Trust Score có cấu phần
insert into public.company_verifications (company_id,kind,status)
 select id,'tax','verified' from public.companies c
 where verified_tier in ('legal','capability','gold')
   and not exists (select 1 from public.company_verifications v where v.company_id=c.id and v.kind='tax');
insert into public.company_verifications (company_id,kind,status,cert_class)
 select id,'capability_cert','verified','Hạng I' from public.companies c
 where verified_tier in ('capability','gold')
   and not exists (select 1 from public.company_verifications v where v.company_id=c.id and v.kind='capability_cert');

-- Dự án tiêu biểu (2 mỗi công ty)
insert into public.projects (company_id,title,year,role,province_code)
 select id, 'Công trình tiêu biểu — '||name, 2023, 'Tổng thầu', province_code from public.companies c
 where not exists (select 1 from public.projects p where p.company_id=c.id);
insert into public.projects (company_id,title,year,role,province_code)
 select id, 'Dự án hoàn thành 2022 — '||name, 2022, 'Thi công', province_code from public.companies c
 where (select count(*) from public.projects p where p.company_id=c.id) < 2;

-- Tính Trust Score cho toàn bộ
select public.compute_trust_score(id) from public.companies where status='published' and deleted_at is null;
