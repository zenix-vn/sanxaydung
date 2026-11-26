-- =============================================================
-- 20261126100100_admin_company_detail.sql
-- Trang chi tiết doanh nghiệp trong /admin:
--   admin_company_detail     gom toàn bộ dữ liệu 1 hồ sơ   (kiểm duyệt viên trở lên;
--                            email thành viên, gói và nhật ký chỉ quản trị viên)
--   admin_update_company     sửa thông tin, lĩnh vực, khu vực
--   admin_set_company_owner  gán / đổi / gỡ chủ sở hữu
--   admin_remove_member      gỡ thành viên khỏi công ty
--   admin_merge_companies    gộp hồ sơ trùng (nguồn bị xóa mềm, dữ liệu chuyển sang đích)
-- =============================================================

create or replace function public.admin_company_detail(_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  c companies%rowtype;
  v_full boolean;
  r jsonb;
begin
  perform _require_role('moderator');
  v_full := has_platform_role('admin');
  select * into c from companies where id = _company;
  if not found then return null; end if;

  r := jsonb_build_object(
    'company', to_jsonb(c) - 'search_tsv',
    'category_ids', (select coalesce(jsonb_agg(category_id), '[]') from company_categories where company_id = c.id),
    'province_codes', (select coalesce(jsonb_agg(province_code), '[]') from company_locations where company_id = c.id),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'name', p.full_name, 'role', m.role, 'status', m.status, 'created_at', m.created_at,
               'email', case when v_full then u.email end)
             order by (m.status = 'active') desc, array_position(array['owner','admin','editor','member'], m.role), m.created_at), '[]')
        from company_members m
        left join profiles p on p.id = m.user_id
        left join auth.users u on u.id = m.user_id
       where m.company_id = c.id),
    'verifications', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc), '[]')
        from company_verifications v where v.company_id = c.id),
    'claims', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', cl.id, 'name', p.full_name, 'email', case when v_full then u.email end,
               'method', cl.method, 'status', cl.status, 'phone', cl.claimed_phone, 'note', cl.note, 'created_at', cl.created_at)
             order by cl.created_at desc), '[]')
        from company_claims cl
        left join profiles p on p.id = cl.user_id
        left join auth.users u on u.id = cl.user_id
       where cl.company_id = c.id),
    'registrations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', g.id, 'company_name', g.company_name, 'contact_name', g.contact_name, 'contact_role', g.contact_role,
               'phone', g.phone, 'source', g.source, 'status', g.status, 'created_at', g.created_at,
               'email', g.payload->>'email_google')
             order by g.created_at desc), '[]')
        from partner_registrations g where g.company_id = c.id),
    'reviews', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select rv.created_at, jsonb_build_object('id', rv.id, 'overall', rv.overall, 'comment', rv.comment, 'status', rv.status,
                 'created_at', rv.created_at, 'reviewer', rc.name) as j
          from reviews rv left join companies rc on rc.id = rv.reviewer_company_id
         where rv.target_company_id = c.id order by rv.created_at desc limit 20) x),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object('id', rp.id, 'entity_type', rp.entity_type, 'reason', rp.reason,
               'status', rp.status, 'created_at', rp.created_at) order by rp.created_at desc), '[]')
        from reports rp
       where rp.entity_id = c.id
          or rp.entity_id in (select id from posts where company_id = c.id
                              union select id from marketplace_listings where company_id = c.id
                              union select id from reviews where target_company_id = c.id)),
    'trust', (select to_jsonb(t) from trust_scores t where t.company_id = c.id),
    'trust_history', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        -- chỉ giữ các mốc điểm thay đổi
        select created_at, jsonb_build_object('score', score, 'created_at', created_at) as j
          from (select score, created_at, lag(score) over (order by created_at) as prev
                  from trust_score_history where company_id = c.id) h
         where prev is distinct from score
         order by created_at desc limit 8) x),
    'counts', jsonb_build_object(
      'projects',  (select count(*) from projects where company_id = c.id),
      'documents', (select count(*) from documents where company_id = c.id),
      'services',  (select count(*) from services where company_id = c.id),
      'equipment', (select count(*) from equipment where company_id = c.id),
      'staff',     (select count(*) from staff where company_id = c.id),
      'posts',     (select count(*) from posts where company_id = c.id and deleted_at is null),
      'listings',  (select count(*) from marketplace_listings where company_id = c.id and deleted_at is null),
      'quotes',    (select count(*) from quotes where company_id = c.id),
      'connections', (select count(*) from connections where c.id in (requester_company_id, target_company_id))),
    'duplicates', (
      select coalesce(jsonb_agg(x.j), '[]') from (
        select jsonb_build_object('id', d.id, 'name', d.name, 'slug', d.slug, 'phone', d.phone, 'tax_code', d.tax_code,
                 'has_owner', d.owner_id is not null, 'status', d.status,
                 'same_phone', normalize_phone(d.phone) = normalize_phone(c.phone),
                 'same_tax', nullif(trim(d.tax_code), '') = nullif(trim(c.tax_code), ''),
                 'similarity', round(similarity(lower(unaccent(d.name)), lower(unaccent(c.name)))::numeric, 2)) as j
          from companies d
         where d.id <> c.id and d.deleted_at is null
           and (normalize_phone(d.phone) = normalize_phone(c.phone)
                or nullif(trim(d.tax_code), '') = nullif(trim(c.tax_code), '')
                or similarity(lower(unaccent(d.name)), lower(unaccent(c.name))) > 0.6)
         order by similarity(lower(unaccent(d.name)), lower(unaccent(c.name))) desc
         limit 10) x)
  );

  if v_full then
    r := r || jsonb_build_object(
      'subscriptions', (
        select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'plan', coalesce(pl.name, s.plan_id), 'status', s.status,
                 'started_at', s.started_at, 'expires_at', s.expires_at) order by s.started_at desc nulls last), '[]')
          from subscriptions s left join plans pl on pl.id = s.plan_id where s.company_id = c.id),
      'audit', (
        select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
          select a.created_at, jsonb_build_object('id', a.id, 'action', a.action, 'actor', p.full_name,
                   'diff', a.diff, 'created_at', a.created_at) as j
            from audit_log a left join profiles p on p.id = a.actor_id
           where a.company_id = c.id or a.entity_id = c.id
           order by a.created_at desc limit 30) x));
  end if;
  return r;
end $$;

-- ---------- Sửa thông tin ----------
create or replace function public.admin_update_company(
  _company uuid, _patch jsonb, _categories uuid[] default null, _provinces text[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  c companies%rowtype;
  n companies%rowtype;
  k text;
  v text;
  v_diff jsonb := '{}';
  v_dup text;
begin
  perform _require_role('admin');
  select * into c from companies where id = _company and deleted_at is null for update;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;
  n := c;

  for k, v in select key, nullif(trim(value), '') from jsonb_each_text(coalesce(_patch, '{}')) loop
    case k
      when 'name' then n.name := v;
      when 'legal_name' then n.legal_name := v;
      when 'tax_code' then n.tax_code := v;
      when 'phone' then n.phone := v;
      when 'email' then n.email := v;
      when 'website' then n.website := v;
      when 'address' then n.address := v;
      when 'province_code' then n.province_code := v;
      when 'size_range' then n.size_range := v;
      when 'intro' then n.intro := v;
      when 'description' then n.description := v;
      when 'founded_year' then
        if v is not null and v !~ '^\d{4}$' then raise exception 'Năm thành lập không hợp lệ' using errcode = '22023'; end if;
        n.founded_year := v::int;
      else raise exception 'Không được sửa trường %', k using errcode = '22023';
    end case;
  end loop;

  if n.name is null then raise exception 'Tên doanh nghiệp là bắt buộc' using errcode = '22023'; end if;
  if n.founded_year is distinct from c.founded_year and n.founded_year is not null
     and n.founded_year not between 1900 and extract(year from now())::int then
    raise exception 'Năm thành lập không hợp lệ' using errcode = '22023';
  end if;
  if n.email is distinct from c.email and n.email is not null and n.email !~ '^\S+@\S+\.\S+$' then
    raise exception 'Email không hợp lệ' using errcode = '22023';
  end if;
  if n.province_code is distinct from c.province_code and n.province_code is not null
     and not exists (select 1 from provinces where code = n.province_code) then
    raise exception 'Tỉnh/thành không hợp lệ' using errcode = '22023';
  end if;
  -- SĐT là khóa chống trùng chính; chỉ kiểm tra khi thực sự đổi số
  if n.phone is not null and normalize_phone(n.phone) is distinct from normalize_phone(c.phone) then
    if length(coalesce(normalize_phone(n.phone), '')) < 9 then
      raise exception 'Số điện thoại không hợp lệ' using errcode = '22023';
    end if;
    n.phone := normalize_phone(n.phone);
    select name into v_dup from companies
     where id <> c.id and deleted_at is null and normalize_phone(phone) = n.phone limit 1;
    if v_dup is not null then
      raise exception 'Số điện thoại đã thuộc hồ sơ "%"', v_dup using errcode = '23505';
    end if;
  end if;

  select coalesce(jsonb_object_agg(o.key, jsonb_build_array(o.value, m.value)), '{}') into v_diff
    from jsonb_each(to_jsonb(c)) o
    join jsonb_each(to_jsonb(n)) m on m.key = o.key
   where o.value is distinct from m.value;

  update companies set
    name = n.name, legal_name = n.legal_name, tax_code = n.tax_code, phone = n.phone, email = n.email,
    website = n.website, address = n.address, province_code = n.province_code, founded_year = n.founded_year,
    size_range = n.size_range, intro = n.intro, description = n.description
   where id = c.id;

  if _categories is not null then
    if exists (select 1 from company_categories where company_id = c.id and category_id <> all(_categories))
       or exists (select 1 from unnest(_categories) x where not exists
                    (select 1 from company_categories where company_id = c.id and category_id = x)) then
      delete from company_categories where company_id = c.id;
      insert into company_categories(company_id, category_id)
        select c.id, id from categories where id = any(_categories);
      v_diff := v_diff || jsonb_build_object('categories',
        (select coalesce(jsonb_agg(name order by name), '[]') from categories where id = any(_categories)));
    end if;
  end if;

  if _provinces is not null then
    if exists (select 1 from company_locations where company_id = c.id and province_code <> all(_provinces))
       or exists (select 1 from unnest(_provinces) x where not exists
                    (select 1 from company_locations where company_id = c.id and province_code = x)) then
      delete from company_locations where company_id = c.id;
      insert into company_locations(company_id, province_code)
        select c.id, code from provinces where code = any(_provinces);
      v_diff := v_diff || jsonb_build_object('locations',
        (select coalesce(jsonb_agg(name order by name), '[]') from provinces where code = any(_provinces)));
    end if;
  end if;

  if v_diff <> '{}'::jsonb then
    perform compute_trust_score(c.id);
    perform _admin_audit('company.admin_update', 'company', c.id, c.id, v_diff);
  end if;
end $$;

-- ---------- Chủ sở hữu ----------
create or replace function public.admin_set_company_owner(
  _company uuid, _email text default null, _keep_previous boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  c companies%rowtype;
  v_new uuid;
  v_old uuid[];
begin
  perform _require_role('admin');
  select * into c from companies where id = _company and deleted_at is null for update;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;

  if nullif(trim(coalesce(_email, '')), '') is not null then
    select u.id into v_new from auth.users u join profiles p on p.id = u.id
     where lower(u.email) = lower(trim(_email)) and u.deleted_at is null
       and (u.banned_until is null or u.banned_until <= now())
     limit 1;
    if v_new is null then
      raise exception 'Không tìm thấy tài khoản đang hoạt động với email này (người dùng cần đăng nhập ít nhất một lần)' using errcode = 'P0002';
    end if;
  end if;

  select array_agg(distinct x) into v_old from (
    select c.owner_id as x
    union select user_id from company_members where company_id = c.id and role = 'owner' and status = 'active') s
   where x is not null and x is distinct from v_new;

  if v_new is not distinct from c.owner_id and v_old is null then
    raise exception 'Không có gì thay đổi: tài khoản này đã là chủ sở hữu' using errcode = '22023';
  end if;

  if v_old is not null then
    update company_members
       set role = case when _keep_previous then 'admin' else 'member' end,
           status = case when _keep_previous then 'active' else 'removed' end
     where company_id = c.id and user_id = any(v_old);
  end if;

  update companies set owner_id = v_new where id = c.id;
  if v_new is not null then
    insert into company_members(company_id, user_id, role, status) values (c.id, v_new, 'owner', 'active')
      on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
    update company_claims
       set status = case when user_id = v_new then 'approved' else 'rejected' end,
           reviewed_by = auth.uid(), reviewed_at = now()
     where company_id = c.id and status = 'pending';
  end if;

  perform _admin_audit('company.owner_changed', 'company', c.id, c.id,
    jsonb_build_object('from', c.owner_id, 'to', v_new, 'keep_previous', _keep_previous));
end $$;

create or replace function public.admin_remove_member(_company uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_role('admin');
  if exists (select 1 from companies where id = _company and owner_id = _user) then
    raise exception 'Đây là chủ sở hữu — dùng chức năng đổi chủ sở hữu' using errcode = '22023';
  end if;
  update company_members set status = 'removed', role = 'member'
   where company_id = _company and user_id = _user and status <> 'removed';
  if not found then raise exception 'Không tìm thấy thành viên' using errcode = 'P0002'; end if;
  perform _admin_audit('company.member_removed', 'company', _company, _company, jsonb_build_object('user_id', _user));
end $$;

-- ---------- Gộp hồ sơ trùng ----------
create or replace function public.admin_merge_companies(_source uuid, _target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s companies%rowtype;
  t companies%rowtype;
  tbl text;
  n int;
  v_moved jsonb := '{}';
  v_tiers text[] := array['none', 'legal', 'capability', 'gold'];
begin
  perform _require_role('admin');
  if _source = _target then raise exception 'Hai hồ sơ phải khác nhau' using errcode = '22023'; end if;
  -- khóa theo thứ tự id để tránh deadlock
  perform 1 from companies where id in (_source, _target) order by id for update;
  select * into s from companies where id = _source and deleted_at is null;
  if not found then raise exception 'Không tìm thấy hồ sơ nguồn' using errcode = 'P0002'; end if;
  select * into t from companies where id = _target and deleted_at is null;
  if not found then raise exception 'Không tìm thấy hồ sơ đích' using errcode = 'P0002'; end if;
  if s.owner_id is not null and t.owner_id is not null and s.owner_id <> t.owner_id then
    raise exception 'Hai hồ sơ đang thuộc hai chủ khác nhau — gỡ chủ sở hữu của một bên trước' using errcode = '22023';
  end if;

  -- bảng chuyển thẳng
  foreach tbl in array array['company_invitations','company_verifications','projects','media','documents','services',
                             'equipment','staff','posts','marketplace_listings','notifications','ad_placements'] loop
    execute format('update public.%I set company_id = $1 where company_id = $2', tbl) using t.id, s.id;
    get diagnostics n = row_count;
    if n > 0 then v_moved := v_moved || jsonb_build_object(tbl, n); end if;
  end loop;

  -- thành viên: người có ở cả hai giữ vai trò cao hơn
  update company_members tm set role = sm.role, status = 'active'
    from company_members sm
   where tm.company_id = t.id and sm.company_id = s.id and sm.user_id = tm.user_id and sm.status = 'active'
     and (tm.status <> 'active'
          or array_position(array['member','editor','admin','owner'], sm.role)
             > array_position(array['member','editor','admin','owner'], tm.role));
  update company_members m set company_id = t.id
   where m.company_id = s.id
     and not exists (select 1 from company_members x where x.company_id = t.id and x.user_id = m.user_id);
  delete from company_members where company_id = s.id;

  insert into company_categories(company_id, category_id)
    select t.id, category_id from company_categories where company_id = s.id on conflict do nothing;
  insert into company_locations(company_id, province_code)
    select t.id, province_code from company_locations where company_id = s.id on conflict do nothing;
  delete from company_categories where company_id = s.id;
  delete from company_locations where company_id = s.id;

  -- bảng có ràng buộc duy nhất: bản trùng ở lại hồ sơ nguồn
  update quotes q set company_id = t.id where q.company_id = s.id
     and not exists (select 1 from quotes x where x.company_id = t.id and x.listing_id = q.listing_id);
  update conversation_participants p set company_id = t.id where p.company_id = s.id
     and not exists (select 1 from conversation_participants x where x.company_id = t.id and x.conversation_id = p.conversation_id);
  update messages set sender_company_id = t.id where sender_company_id = s.id;
  update connections set requester_company_id = t.id where requester_company_id = s.id and target_company_id <> t.id;
  update connections set target_company_id = t.id where target_company_id = s.id and requester_company_id <> t.id;
  update reviews r set target_company_id = t.id where r.target_company_id = s.id and r.reviewer_company_id <> t.id;
  update reviews r set reviewer_company_id = t.id where r.reviewer_company_id = s.id and r.target_company_id <> t.id
     and not exists (select 1 from reviews x where x.reviewer_company_id = t.id and x.connection_id = r.connection_id);

  -- chỉ giữ 1 gói đang chạy
  if exists (select 1 from subscriptions where company_id = t.id and status = 'active') then
    update subscriptions set status = 'cancelled' where company_id = s.id and status = 'active';
  end if;
  update subscriptions set company_id = t.id where company_id = s.id;

  update company_claims c set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where c.company_id = s.id and c.status = 'pending'
     and exists (select 1 from company_claims x where x.company_id = t.id and x.user_id = c.user_id and x.status = 'pending');
  update company_claims set company_id = t.id where company_id = s.id;

  -- đánh dấu 'duplicate' để sync_all_registrations không ghi đè hồ sơ đích bằng dữ liệu bản trùng
  update partner_registrations set company_id = t.id, status = 'duplicate' where company_id = s.id;

  update companies set deleted_at = now(), status = 'draft', owner_id = null, verified_tier = 'none' where id = s.id;
  delete from trust_scores where company_id = s.id;

  -- lấp chỗ trống của hồ sơ đích bằng dữ liệu nguồn
  update companies set
    legal_name = coalesce(legal_name, s.legal_name), tax_code = coalesce(nullif(trim(tax_code), ''), s.tax_code),
    phone = coalesce(nullif(trim(phone), ''), s.phone), email = coalesce(email, s.email),
    website = coalesce(website, s.website), address = coalesce(address, s.address),
    province_code = coalesce(province_code, s.province_code), founded_year = coalesce(founded_year, s.founded_year),
    size_range = coalesce(size_range, s.size_range), intro = coalesce(intro, s.intro),
    description = coalesce(description, s.description), logo_url = coalesce(logo_url, s.logo_url),
    cover_url = coalesce(cover_url, s.cover_url), owner_id = coalesce(owner_id, s.owner_id),
    verified_tier = v_tiers[greatest(array_position(v_tiers, verified_tier), array_position(v_tiers, s.verified_tier))]
   where id = t.id returning * into t;

  -- chỉ một vai trò 'owner', khớp companies.owner_id
  if t.owner_id is not null then
    update company_members set role = 'admin' where company_id = t.id and role = 'owner' and user_id <> t.owner_id;
    insert into company_members(company_id, user_id, role, status) values (t.id, t.owner_id, 'owner', 'active')
      on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
  end if;

  perform compute_trust_score(t.id);
  perform _admin_audit('company.merged', 'company', t.id, t.id,
    jsonb_build_object('source_id', s.id, 'source_name', s.name, 'source_slug', s.slug,
                       'source_phone', s.phone, 'moved', v_moved));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_company_detail(uuid)',
    'admin_update_company(uuid, jsonb, uuid[], text[])',
    'admin_set_company_owner(uuid, text, boolean)',
    'admin_remove_member(uuid, uuid)',
    'admin_merge_companies(uuid, uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
