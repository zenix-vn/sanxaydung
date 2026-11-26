-- =============================================================
-- 20261126110000_admin_import.sql
-- Nhập doanh nghiệp hàng loạt từ CSV trong /admin và ghi vết khi xuất dữ liệu.
--   admin_import_partners  xem trước / đưa vào hàng chờ / tạo hồ sơ ngay
--   admin_log_export       ghi nhật ký mỗi lần xuất CSV
-- Kèm 2 vá:
--   - sync_registration không ghi đè hồ sơ quản trị đã sửa tay hoặc đã gộp
--   - duyệt đăng ký đối tác bị chặn nếu SĐT đã có hồ sơ (tránh tạo trùng)
-- =============================================================

create or replace function public.admin_import_partners(_rows jsonb, _mode text default 'preview')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  i int;
  v_total int;
  v_name text; v_phone text; v_tax text; v_group text;
  v_status text; v_msg text;
  v_company uuid; v_reg uuid;
  v_cats text[]; v_provs text[];
  v_later int;
  v_done int := 0;
  v_out jsonb := '[]';
begin
  perform _require_role('admin');
  if _mode not in ('preview', 'queue', 'publish') then
    raise exception 'Chế độ không hợp lệ' using errcode = '22023';
  end if;
  if _rows is null or jsonb_typeof(_rows) <> 'array' then
    raise exception 'Dữ liệu không hợp lệ' using errcode = '22023';
  end if;
  v_total := jsonb_array_length(_rows);
  if v_total > 500 then
    raise exception 'Tối đa 500 dòng mỗi lần' using errcode = '22023';
  end if;

  for i in 0 .. v_total - 1 loop
    r := _rows -> i;
    v_status := null; v_msg := null; v_company := null;
    v_name  := nullif(trim(r ->> 'company_name'), '');
    v_phone := normalize_phone(r ->> 'phone');
    v_tax   := nullif(regexp_replace(coalesce(r ->> 'tax_code', ''), '\s', '', 'g'), '');

    if v_name is null then
      v_status := 'invalid'; v_msg := 'Thiếu tên doanh nghiệp';
    elsif v_phone is null or v_phone !~ '^0\d{8,10}$' then
      v_status := 'invalid'; v_msg := 'Số điện thoại trống hoặc sai định dạng';
    end if;

    -- trùng trong file: lấy dòng cuối (bản trả lời mới nhất)
    if v_status is null then
      select e.o into v_later from jsonb_array_elements(_rows) with ordinality e(v, o)
       where e.o > i + 1 and nullif(trim(e.v ->> 'company_name'), '') is not null
         and (normalize_phone(e.v ->> 'phone') = v_phone
              or (v_tax is not null and regexp_replace(coalesce(e.v ->> 'tax_code', ''), '\s', '', 'g') = v_tax))
       order by e.o desc limit 1;
      if v_later is not null then
        v_status := 'dup_file'; v_msg := format('Trùng SĐT/MST với dòng %s trong file — chỉ lấy dòng đó', v_later);
      end if;
    end if;

    if v_status is null then
      select c.id, format('Đã có hồ sơ "%s" (trùng %s)', c.name,
               case when normalize_phone(c.phone) = v_phone then 'SĐT' else 'MST' end)
        into v_company, v_msg
        from companies c
       where c.deleted_at is null
         and (normalize_phone(c.phone) = v_phone
              or (v_tax is not null and regexp_replace(coalesce(c.tax_code, ''), '\s', '', 'g') = v_tax))
       order by (normalize_phone(c.phone) = v_phone) desc limit 1;
      if found then v_status := 'dup_company'; end if;
    end if;

    if v_status is null then
      select g.company_id, format('Đã có bản đăng ký "%s" (%s)', g.company_name,
               case g.status when 'pending' then 'đang chờ duyệt' when 'approved' then 'đã duyệt'
                             when 'rejected' then 'đã từ chối' else 'đánh dấu trùng' end)
        into v_company, v_msg
        from partner_registrations g
       where normalize_phone(g.phone) = v_phone or (v_tax is not null and g.tax_code = v_tax)
       limit 1;
      if found then v_status := 'dup_registration'; end if;
    end if;

    if v_status is null then
      v_status := 'new';
      if _mode <> 'preview' then
        begin
          v_cats  := array(select jsonb_array_elements_text(case when jsonb_typeof(r -> 'category_slugs') = 'array' then r -> 'category_slugs' else '[]' end));
          v_provs := array(select jsonb_array_elements_text(case when jsonb_typeof(r -> 'province_codes') = 'array' then r -> 'province_codes' else '[]' end));
          v_group := case when r ->> 'group_key' in ('contractor', 'crew', 'supplier', 'service') then r ->> 'group_key'
                          else (select group_key from categories where slug = any(v_cats) limit 1) end;

          insert into partner_registrations(
              phone, tax_code, company_name, legal_name, contact_name, contact_role, group_key, category_slugs, province_codes,
              address, website, intro, logo_url, founded_year, size_range, capability_class, source, payload)
            values (
              v_phone, v_tax, v_name, nullif(trim(r ->> 'legal_name'), ''), nullif(trim(r ->> 'contact_name'), ''),
              nullif(trim(r ->> 'contact_role'), ''), v_group, nullif(v_cats, '{}'), nullif(v_provs, '{}'),
              nullif(trim(r ->> 'address'), ''), nullif(trim(r ->> 'website'), ''), nullif(trim(r ->> 'intro'), ''),
              case when r ->> 'logo_url' ~* '^https://' then r ->> 'logo_url' end,
              case when r ->> 'founded_year' ~ '^(19|20)\d{2}$' and (r ->> 'founded_year')::int <= extract(year from now())
                   then (r ->> 'founded_year')::int end,
              nullif(trim(r ->> 'size_range'), ''), nullif(trim(r ->> 'capability_class'), ''), 'admin_csv',
              jsonb_strip_nulls(jsonb_build_object(
                'email_google', nullif(lower(trim(r ->> 'email_google')), ''),
                'raw', r -> 'raw', 'imported_by', auth.uid())))
            returning id into v_reg;

          if _mode = 'publish' then
            v_company := promote_registration(v_reg);
            update partner_registrations set reviewed_by = auth.uid() where id = v_reg;
          end if;
          v_done := v_done + 1;
        exception when others then
          v_status := 'error'; v_msg := sqlerrm; v_company := null;
        end;
      end if;
    end if;

    v_out := v_out || jsonb_build_object('row', i, 'status', v_status, 'message', v_msg, 'company_id', v_company);
  end loop;

  if v_done > 0 then
    perform _admin_audit('import.partners', 'import', gen_random_uuid(), null,
                         jsonb_build_object('mode', _mode, 'rows', v_total, 'imported', v_done));
  end if;
  return v_out;
end $$;

create or replace function public.admin_log_export(_kind text, _count int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_role('admin');
  perform _admin_audit('export.csv', left(_kind, 40), gen_random_uuid(), null, jsonb_build_object('data', left(_kind, 40), 'rows', _count));
end $$;

-- ---------- Vá: đồng bộ không ghi đè chỉnh sửa của quản trị ----------
create or replace function public.sync_registration(_reg uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r partner_registrations%rowtype;
  v_company uuid;
  v_slug text;
begin
  select * into r from partner_registrations where id = _reg;
  if not found then
    raise exception 'Không tìm thấy bản đăng ký %', _reg using errcode = 'P0002';
  end if;

  if r.company_id is null then
    -- SĐT đã có hồ sơ (vd. chủ tự tạo): để quản trị xử lý, không tạo trùng
    if exists (select 1 from companies where deleted_at is null and normalize_phone(phone) = normalize_phone(r.phone)) then
      return null;
    end if;
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
    -- CẬP NHẬT (chỉ khi CHƯA có chủ và quản trị chưa can thiệp)
    v_company := r.company_id;
    if exists (select 1 from companies where id = v_company and (owner_id is not null or deleted_at is not null))
       or exists (select 1 from audit_log where company_id = v_company
                   and action in ('company.admin_update', 'company.merged', 'company.owner_changed')) then
      return v_company;
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

-- ---------- Vá: duyệt đăng ký không tạo hồ sơ trùng SĐT ----------
create or replace function public.admin_review_registration(_reg uuid, _action text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_dup text;
begin
  perform _require_admin();
  if _action = 'approve' then
    select c.name into v_dup
      from partner_registrations g
      join companies c on normalize_phone(c.phone) = normalize_phone(g.phone) and c.deleted_at is null
     where g.id = _reg and g.company_id is null
     limit 1;
    if v_dup is not null then
      raise exception 'SĐT này đã có hồ sơ "%" — hãy đánh dấu Trùng', v_dup using errcode = '23505';
    end if;
    v_company := public.promote_registration(_reg);
    update partner_registrations
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), company_id = v_company
     where id = _reg;
  elsif _action in ('reject', 'duplicate') then
    update partner_registrations
       set status = case when _action = 'reject' then 'rejected' else 'duplicate' end,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = _reg;
  else
    raise exception 'Hành động không hợp lệ' using errcode = '22023';
  end if;
  perform _admin_audit('registration.' || _action, 'partner_registration', _reg, v_company, '{}');
  return v_company;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_import_partners(jsonb, text)', 'admin_log_export(text, int)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
