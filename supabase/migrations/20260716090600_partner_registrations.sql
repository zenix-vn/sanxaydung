-- =============================================================
-- 20260716090600_partner_registrations.sql
-- Bảng staging thu thập đối tác (qua Google Form) + promote sang companies
-- =============================================================

create table public.partner_registrations (
  id             uuid primary key default gen_random_uuid(),
  -- định danh chống trùng
  zalo_uid       text,
  phone          text not null,
  phone_verified boolean default false,
  tax_code       text,                    -- CÓ THỂ ĐỂ TRỐNG (đội thi công/cá nhân không có MST)
  -- thông tin khai
  company_name   text not null,
  legal_name     text,
  contact_name   text,
  contact_role   text,
  group_key      text,                    -- contractor|crew|supplier|service
  category_slugs text[],                  -- slug danh mục
  province_codes text[],                  -- mã tỉnh
  address        text,
  website        text,
  intro          text,
  logo_url       text,
  founded_year   int,
  size_range     text,
  capability_class text,
  payload        jsonb default '{}',       -- trường tùy chọn / dữ liệu thô chưa map
  -- kiểm soát
  invite_token   text,
  source         text default 'google_form',
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','duplicate')),
  company_id     uuid references public.companies(id),  -- set sau khi promote
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  ip             inet,
  created_at     timestamptz default now(),
  -- KHÓA CHỐNG TRÙNG (ở tầng DB). Postgres cho phép NHIỀU giá trị NULL trong UNIQUE,
  -- nên MST/zalo trống không xung đột; khi MST trống thì SĐT là khóa chống trùng chính.
  constraint uq_reg_tax   unique (tax_code),
  constraint uq_reg_phone unique (phone),
  constraint uq_reg_zalo  unique (zalo_uid)
);
create index partner_reg_status_idx on public.partner_registrations (status, created_at);

-- RLS: khóa hoàn toàn với client. Chỉ service_role (import/Edge Function) ghi/đọc.
alter table public.partner_registrations enable row level security;
-- (không tạo policy ⇒ client bị chặn; service_role bỏ qua RLS)

-- ---------- slugify (bỏ dấu tiếng Việt → slug URL) ----------
create or replace function public.slugify(_t text)
returns text language sql stable as $$
  select trim(both '-' from
    regexp_replace(lower(unaccent(coalesce(_t,''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------- promote_registration: staging → companies ----------
create or replace function public.promote_registration(_reg uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r partner_registrations%rowtype;
  v_company uuid;
  v_slug text;
begin
  select * into r from partner_registrations where id = _reg;
  if not found then
    raise exception 'Không tìm thấy bản đăng ký %', _reg using errcode='P0002';
  end if;
  if r.company_id is not null then
    return r.company_id;   -- đã promote trước đó
  end if;

  -- slug duy nhất
  v_slug := nullif(public.slugify(r.company_name), '');
  v_slug := coalesce(v_slug, 'doanh-nghiep');
  if exists (select 1 from companies where slug = v_slug) then
    v_slug := v_slug || '-' || left(replace(_reg::text,'-',''), 6);
  end if;

  insert into companies (slug, name, legal_name, tax_code, phone, intro, website,
                         address, founded_year, size_range, logo_url, status)
    values (v_slug, r.company_name, r.legal_name, r.tax_code, r.phone, r.intro, r.website,
            r.address, r.founded_year, r.size_range, r.logo_url, 'published')
    returning id into v_company;

  -- danh mục
  if r.category_slugs is not null then
    insert into company_categories (company_id, category_id)
      select v_company, c.id from categories c where c.slug = any(r.category_slugs)
      on conflict do nothing;
  end if;

  -- khu vực
  if r.province_codes is not null then
    insert into company_locations (company_id, province_code)
      select v_company, p.code from provinces p where p.code = any(r.province_codes)
      on conflict do nothing;
  end if;

  -- tạo yêu cầu xác minh MST ở trạng thái chờ (chỉ khi có MST)
  if nullif(trim(r.tax_code), '') is not null then
    insert into company_verifications (company_id, kind, reference, status)
      values (v_company, 'tax', r.tax_code, 'pending');
  end if;

  update partner_registrations
     set status='approved', company_id=v_company, reviewed_at=now()
   where id = _reg;

  perform public.compute_trust_score(v_company);
  return v_company;
end $$;
