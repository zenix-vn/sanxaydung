-- =============================================================
-- 20260716090800_sync_registration.sql
-- Đồng bộ partner_registrations -> companies (tạo mới HOẶC cập nhật).
-- Tôn trọng hồ sơ đã có chủ (owner_id) — không ghi đè chỉnh sửa của chủ.
-- =============================================================

create or replace function public.sync_registration(_reg uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r partner_registrations%rowtype;
  v_company uuid;
  v_slug text;
  v_owner uuid;
begin
  select * into r from partner_registrations where id = _reg;
  if not found then
    raise exception 'Không tìm thấy bản đăng ký %', _reg using errcode = 'P0002';
  end if;

  if r.company_id is null then
    -- TẠO MỚI
    v_slug := coalesce(nullif(public.slugify(r.company_name), ''), 'doanh-nghiep');
    if exists (select 1 from companies where slug = v_slug) then
      v_slug := v_slug || '-' || left(replace(_reg::text, '-', ''), 6);
    end if;
    insert into companies (slug, name, legal_name, tax_code, phone, intro, website,
                           address, founded_year, size_range, logo_url, status)
      values (v_slug, r.company_name, r.legal_name, r.tax_code, r.phone, r.intro, r.website,
              r.address, r.founded_year, r.size_range, r.logo_url, 'published')
      returning id into v_company;
    update partner_registrations
       set company_id = v_company, status = 'approved', reviewed_at = now()
     where id = _reg;
  else
    -- CẬP NHẬT (chỉ khi CHƯA có chủ)
    v_company := r.company_id;
    select owner_id into v_owner from companies where id = v_company;
    if v_owner is not null then
      return v_company;   -- đã claim -> tôn trọng, không đụng
    end if;
    update companies set
        name = r.company_name, legal_name = r.legal_name, tax_code = r.tax_code, phone = r.phone,
        intro = r.intro, website = r.website, address = r.address, founded_year = r.founded_year,
        size_range = r.size_range, logo_url = coalesce(r.logo_url, logo_url), updated_at = now()
      where id = v_company;
  end if;

  -- Đồng bộ danh mục & khu vực
  delete from company_categories where company_id = v_company;
  if r.category_slugs is not null then
    insert into company_categories (company_id, category_id)
      select v_company, c.id from categories c where c.slug = any(r.category_slugs)
      on conflict do nothing;
  end if;
  delete from company_locations where company_id = v_company;
  if r.province_codes is not null then
    insert into company_locations (company_id, province_code)
      select v_company, p.code from provinces p where p.code = any(r.province_codes)
      on conflict do nothing;
  end if;

  if nullif(trim(r.tax_code), '') is not null
     and not exists (select 1 from company_verifications where company_id = v_company and kind = 'tax') then
    insert into company_verifications (company_id, kind, reference, status)
      values (v_company, 'tax', r.tax_code, 'pending');
  end if;

  perform public.compute_trust_score(v_company);
  return v_company;
end $$;

-- Đồng bộ toàn bộ (gọi sau mỗi lần import). Trả về số bản đã xử lý.
create or replace function public.sync_all_registrations()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; rec record;
begin
  for rec in select id from partner_registrations where status in ('pending','approved') loop
    perform public.sync_registration(rec.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Khóa quyền các hàm nhạy cảm (chỉ service_role gọi được).
-- LƯU Ý: Postgres cấp EXECUTE cho PUBLIC mặc định -> phải revoke cả PUBLIC.
revoke execute on function public.promote_registration(uuid)     from public, anon, authenticated;
revoke execute on function public.sync_registration(uuid)        from public, anon, authenticated;
revoke execute on function public.sync_all_registrations()       from public, anon, authenticated;
revoke execute on function public.compute_trust_score(uuid)      from public, anon, authenticated;
grant  execute on function public.sync_registration(uuid), public.sync_all_registrations() to service_role;
