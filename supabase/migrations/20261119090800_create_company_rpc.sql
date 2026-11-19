-- =============================================================
-- Sửa lỗi "new row violates row-level security policy for table company_members"
-- khi tạo công ty mới: policy cm_bootstrap_owner kiểm tra companies của chính mình,
-- nhưng companies_read chặn bản nháp (chưa published, chưa là thành viên) → luôn false.
-- Giải pháp: tạo công ty + thành viên owner trong 1 RPC security definer (atomic).
-- Trả về id công ty; nếu SĐT đã có hồ sơ → lỗi 23505 để UI hướng sang "nhận hồ sơ".
-- =============================================================

create or replace function public.create_company(
  _name text, _phone text, _tax_code text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_phone text := public.normalize_phone(_phone);
  v_base  text := coalesce(nullif(public.slugify(_name), ''), 'doanh-nghiep');
  v_slug  text := v_base;
  v_id    uuid;
  i       int := 0;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(_name, '')), '') is null then
    raise exception 'Thiếu tên doanh nghiệp' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'Số điện thoại không hợp lệ' using errcode = '22023';
  end if;
  if exists (select 1 from companies
              where public.normalize_phone(phone) = v_phone and deleted_at is null) then
    raise exception 'Số điện thoại này đã có hồ sơ trên sàn' using errcode = '23505';
  end if;

  while exists (select 1 from companies where slug = v_slug) loop
    i := i + 1;
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
    exit when i > 10;
  end loop;

  insert into companies(slug, name, phone, tax_code, owner_id, status)
    values (v_slug, trim(_name), v_phone, nullif(trim(coalesce(_tax_code, '')), ''), v_uid, 'draft')
    returning id into v_id;

  insert into company_members(company_id, user_id, role, status)
    values (v_id, v_uid, 'owner', 'active');

  insert into audit_log(actor_id, company_id, action, entity_type, entity_id)
    values (v_uid, v_id, 'company.create', 'company', v_id);
  return v_id;
end $$;

revoke execute on function public.create_company(text, text, text) from public, anon;
grant  execute on function public.create_company(text, text, text) to authenticated;
