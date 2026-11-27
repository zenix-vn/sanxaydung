-- =============================================================
-- 20261130090000_company_website.sql
-- Website doanh nghiệp (giai đoạn 1): mỗi hồ sơ đã xuất bản có một website riêng
-- tại <tên-miền-con>.sanxaydung.vn.
--   - site_subdomain: tên miền con tự chọn (mặc định dùng slug nếu để trống).
--   - site_settings : cấu hình website (enabled, template, seo…) — app làm sạch khi đọc.
--   - Chỉ chủ sở hữu / quản trị được đổi tên miền con và bật/tắt website.
--   - Tên miền con không được trùng slug của doanh nghiệp khác (website mặc định chạy theo slug).
-- =============================================================

alter table public.companies
  add column if not exists site_subdomain text,
  add column if not exists site_settings jsonb not null default '{}'::jsonb;

-- 3–40 ký tự: chữ thường, số, gạch nối; không bắt đầu/kết thúc bằng gạch nối
alter table public.companies drop constraint if exists companies_site_subdomain_format;
alter table public.companies add constraint companies_site_subdomain_format
  check (site_subdomain is null or site_subdomain ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

alter table public.companies drop constraint if exists companies_site_settings_object;
alter table public.companies add constraint companies_site_settings_object
  check (jsonb_typeof(site_settings) = 'object' and pg_column_size(site_settings) < 16384);

create unique index if not exists companies_site_subdomain_key on public.companies (site_subdomain)
  where site_subdomain is not null;

-- Tên miền con dành riêng cho hạ tầng của sàn
create or replace function public.is_reserved_subdomain(p text)
returns boolean language sql immutable as $$
  select p = any (array[
    'www','api','app','admin','demo','mail','smtp','imap','pop','ftp','ns1','ns2','cdn','static',
    'assets','img','media','files','storage','auth','rest','realtime','studio','supabase','kong',
    'sites','site','web','blog','help','hotro','support','status','dev','staging','test','beta',
    'san','sanxaydung','dashboard','login','m','mobile','shop','docs','webmail','cpanel'
  ])
$$;

-- ---------- Phân quyền (thay companies_guard của 20261129100000) ----------
create or replace function public.companies_guard()
returns trigger language plpgsql as $$
begin
  -- Kiểm tra trùng/dành riêng áp cho mọi vai trò (kể cả quản trị sàn ghi bằng service_role)
  if new.site_subdomain is not null
     and (tg_op = 'INSERT' or new.site_subdomain is distinct from old.site_subdomain) then
    if public.is_reserved_subdomain(new.site_subdomain) then
      raise exception 'Tên miền con này được dành riêng, vui lòng chọn tên khác' using errcode = '23514';
    end if;
    if exists (select 1 from public.companies c where c.slug = new.site_subdomain and c.id <> new.id) then
      raise exception 'Tên miền con này trùng đường dẫn của doanh nghiệp khác' using errcode = '23505';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.slug is distinct from old.slug
     and exists (select 1 from public.companies c where c.site_subdomain = new.slug and c.id <> new.id) then
    raise exception 'Đường dẫn này đang là tên miền con của doanh nghiệp khác' using errcode = '23505';
  end if;

  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_tier := 'none';
    new.trust_score   := 0;
    new.deleted_at    := null;
    if new.status = 'suspended' then new.status := 'draft'; end if;
    return new;
  end if;

  if new.verified_tier is distinct from old.verified_tier
     or new.trust_score is distinct from old.trust_score
     or new.owner_id    is distinct from old.owner_id
     or new.deleted_at  is distinct from old.deleted_at
     or (new.status is distinct from old.status and 'suspended' in (new.status, old.status)) then
    raise exception 'Trường này do hệ thống quản lý, không thể tự thay đổi' using errcode = '42501';
  end if;

  if (new.name       is distinct from old.name
      or new.slug       is distinct from old.slug
      or new.legal_name is distinct from old.legal_name
      or new.tax_code   is distinct from old.tax_code
      or new.status     is distinct from old.status
      or new.site_subdomain is distinct from old.site_subdomain
      or (new.site_settings -> 'enabled') is distinct from (old.site_settings -> 'enabled')
      or (new.profile_settings -> 'brand_color') is distinct from (old.profile_settings -> 'brand_color'))
     and not public.is_company_member(old.id, 'admin') then
    raise exception 'Chỉ chủ sở hữu hoặc quản trị viên được đổi tên, đường dẫn, tên miền con, thông tin pháp lý, trạng thái, màu thương hiệu và bật/tắt website'
      using errcode = '42501';
  end if;
  return new;
end $$;
