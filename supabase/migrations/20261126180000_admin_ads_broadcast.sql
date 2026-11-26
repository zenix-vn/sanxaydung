-- =============================================================
-- 20261126180000_admin_ads_broadcast.sql
--   Quảng cáo  : vị trí, ảnh, lịch chạy, đếm lượt hiển thị / nhấp
--   Thông báo  : gửi thông báo trong ứng dụng cho một nhóm người dùng
--   Nhân sự    : tóm tắt việc đang chờ gửi vào chuông thông báo mỗi sáng
-- =============================================================

-- ---------- Quảng cáo ----------
alter table public.ad_placements add column if not exists title text;
alter table public.ad_placements add column if not exists created_at timestamptz not null default now();
create table if not exists public.ad_stats (
  ad_id       uuid not null references public.ad_placements(id) on delete cascade,
  day         date not null,
  impressions int not null default 0,
  clicks      int not null default 0,
  primary key (ad_id, day)
);
alter table public.ad_stats enable row level security;
revoke all on public.ad_stats from anon, authenticated;
-- Khách chỉ nhận quảng cáo qua ad_serve (đúng lịch); ghi dữ liệu chỉ qua RPC quản trị
revoke insert, update, delete, truncate on public.ad_placements from anon, authenticated;
drop policy if exists ads_read on public.ad_placements;
create policy ads_read on public.ad_placements for select using (
  public.is_company_member(company_id) or public.has_platform_role('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('ad-creatives', 'ad-creatives', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
drop policy if exists "admin write ad creatives" on storage.objects;
create policy "admin write ad creatives" on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-creatives' and public.has_platform_role('admin'));

create or replace function public.ad_serve(_slot text)
returns jsonb language sql volatile security definer set search_path = public as $$
  select jsonb_build_object('id', a.id, 'title', a.title, 'creative_url', a.creative_url, 'target_url', a.target_url,
                            'company', c.name)
    from ad_placements a
    left join companies c on c.id = a.company_id
   where a.slot = _slot and a.status = 'active'
     and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
     and (a.company_id is null or (c.status = 'published' and c.deleted_at is null))
   order by random() limit 1;
$$;
grant execute on function public.ad_serve(text) to anon, authenticated;

-- Đếm đơn giản theo ngày (giờ VN); chỉ tính quảng cáo đang chạy
create or replace function public.ad_track(_id uuid, _event text)
returns void language sql security definer set search_path = public as $$
  insert into ad_stats as s (ad_id, day, impressions, clicks)
    select a.id, (now() at time zone 'Asia/Ho_Chi_Minh')::date, (_event = 'view')::int, (_event = 'click')::int
      from ad_placements a
     where a.id = _id and _event in ('view', 'click') and a.status = 'active'
       and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at > now())
  on conflict (ad_id, day) do update
    set impressions = s.impressions + excluded.impressions, clicks = s.clicks + excluded.clicks;
$$;
grant execute on function public.ad_track(uuid, text) to anon, authenticated;

create or replace function public.admin_list_ads()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'slot', a.slot, 'creative_url', a.creative_url, 'target_url', a.target_url,
      'starts_at', a.starts_at, 'ends_at', a.ends_at, 'status', a.status, 'company_id', a.company_id, 'company', c.name, 'company_phone', c.phone,
      'impressions', coalesce(t.i, 0), 'clicks', coalesce(t.c, 0), 'impressions_30', coalesce(t.i30, 0), 'clicks_30', coalesce(t.c30, 0))
      order by a.created_at desc), '[]')
    from ad_placements a
    left join companies c on c.id = a.company_id
    left join lateral (
      select sum(impressions) i, sum(clicks) c,
             sum(impressions) filter (where day > current_date - 30) i30, sum(clicks) filter (where day > current_date - 30) c30
        from ad_stats where ad_id = a.id) t on true);
end $$;

create or replace function public.admin_save_ad(
  _id uuid, _title text, _slot text, _creative_url text, _target_url text,
  _company uuid default null, _starts_at timestamptz default null, _ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform _require_role('admin');
  if nullif(trim(coalesce(_title, '')), '') is null then raise exception 'Thiếu tiêu đề' using errcode = '22023'; end if;
  if _slot is null or _slot not in ('home_banner', 'directory_top', 'marketplace_top') then raise exception 'Vị trí không hợp lệ' using errcode = '22023'; end if;
  if coalesce(_creative_url, '') !~ '^(https://|/storage/)[^\s"''<>]+$' then raise exception 'Cần ảnh quảng cáo (https)' using errcode = '22023'; end if;
  -- chỉ https hoặc đường dẫn nội bộ; chặn javascript:, data:, //tên-miền-khác
  if coalesce(_target_url, '') !~ '^(https://[^\s"''<>]+|/[^/\\\s"''<>][^\s"''<>]*)$' then
    raise exception 'Liên kết đích phải bắt đầu bằng https:// hoặc /' using errcode = '22023';
  end if;
  if _starts_at is not null and _ends_at is not null and _ends_at <= _starts_at then raise exception 'Ngày kết thúc phải sau ngày bắt đầu' using errcode = '22023'; end if;
  if _company is not null and not exists (select 1 from companies where id = _company and deleted_at is null) then
    raise exception 'Không tìm thấy công ty' using errcode = 'P0002';
  end if;
  if _id is null then
    insert into ad_placements(title, slot, creative_url, target_url, company_id, starts_at, ends_at, status)
      values (trim(_title), _slot, _creative_url, _target_url, _company, _starts_at, _ends_at, 'active') returning id into v_id;
  else
    update ad_placements set title = trim(_title), slot = _slot, creative_url = _creative_url, target_url = _target_url,
           company_id = _company, starts_at = _starts_at, ends_at = _ends_at
     where id = _id returning id into v_id;
    if v_id is null then raise exception 'Không tìm thấy quảng cáo' using errcode = 'P0002'; end if;
  end if;
  perform _admin_audit(case when _id is null then 'ad.created' else 'ad.updated' end, 'ad', v_id, _company,
                       jsonb_build_object('title', trim(_title), 'slot', _slot));
  return v_id;
end $$;

create or replace function public.admin_set_ad_status(_id uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  perform _require_role('admin');
  if _status is null or _status not in ('active', 'paused', 'deleted') then raise exception 'Trạng thái không hợp lệ' using errcode = '22023'; end if;
  if _status = 'deleted' then
    delete from ad_placements where id = _id returning company_id into v_company;
  else
    update ad_placements set status = _status where id = _id returning company_id into v_company;
  end if;
  if not found then raise exception 'Không tìm thấy quảng cáo' using errcode = 'P0002'; end if;
  perform _admin_audit('ad.' || _status, 'ad', _id, v_company, '{}');
end $$;

-- ---------- Thông báo hàng loạt ----------
create table if not exists public.broadcasts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  link       text,
  filter     jsonb not null default '{}',
  recipients int not null,
  sent_by    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
revoke all on public.broadcasts from anon, authenticated;
grant select on public.broadcasts to authenticated;
drop policy if exists admin_read_broadcasts on public.broadcasts;
create policy admin_read_broadcasts on public.broadcasts for select using (public.has_platform_role('admin'));

/* _filter: { audience: 'all' | 'no_company' | 'companies',
              group, province, verified: 'yes'|'no', plan: 'free'|'paid' }  (4 khóa sau chỉ dùng với 'companies') */
create or replace function public._broadcast_companies(_filter jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from companies c
   where c.deleted_at is null and c.status <> 'suspended'
     and (coalesce(_filter ->> 'group', '') = '' or exists (select 1 from company_categories cc join categories k on k.id = cc.category_id
            where cc.company_id = c.id and k.group_key = _filter ->> 'group'))
     and (coalesce(_filter ->> 'province', '') = '' or c.province_code = _filter ->> 'province'
            or exists (select 1 from company_locations l where l.company_id = c.id and l.province_code = _filter ->> 'province'))
     and case coalesce(_filter ->> 'verified', '') when 'yes' then c.verified_tier <> 'none' when 'no' then c.verified_tier = 'none' else true end
     and case coalesce(_filter ->> 'plan', '')
           when 'paid' then exists (select 1 from subscriptions s join plans p on p.id = s.plan_id where s.company_id = c.id and s.status = 'active' and (s.expires_at is null or s.expires_at > now()) and p.price_month > 0)
           when 'free' then not exists (select 1 from subscriptions s join plans p on p.id = s.plan_id where s.company_id = c.id and s.status = 'active' and (s.expires_at is null or s.expires_at > now()) and p.price_month > 0)
           else true end;
$$;
revoke execute on function public._broadcast_companies(jsonb) from public, anon, authenticated;

create or replace function public._broadcast_users(_filter jsonb)
returns setof uuid language plpgsql stable security definer set search_path = public as $$
declare v_a text := _filter ->> 'audience';
begin
  if v_a is null or v_a not in ('all', 'no_company', 'companies') then raise exception 'Chọn nhóm người nhận' using errcode = '22023'; end if;
  return query
  select p.id from profiles p join auth.users u on u.id = p.id
   where u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
     and case v_a
           when 'all' then true
           when 'no_company' then not exists (select 1 from company_members m where m.user_id = p.id and m.status = 'active')
           else exists (select 1 from company_members m where m.user_id = p.id and m.status = 'active' and m.role in ('owner', 'admin')
                          and m.company_id in (select _broadcast_companies(_filter))) end;
end $$;
revoke execute on function public._broadcast_users(jsonb) from public, anon, authenticated;

create or replace function public.admin_broadcast_preview(_filter jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return jsonb_build_object(
    'recipients', (select count(*) from _broadcast_users(_filter)),
    'companies', case when _filter ->> 'audience' = 'companies' then (select count(*) from _broadcast_companies(_filter)) end,
    -- hồ sơ khớp nhưng chưa có ai nhận được: cần liên hệ qua điện thoại
    'unreachable', case when _filter ->> 'audience' = 'companies' then (
        select count(*) from _broadcast_companies(_filter) x(id)
         where not exists (select 1 from company_members m where m.company_id = x.id and m.status = 'active' and m.role in ('owner', 'admin'))) end);
end $$;

create or replace function public.admin_broadcast_send(_filter jsonb, _title text, _body text, _link text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_title text := nullif(trim(coalesce(_title, '')), '');
  v_body text := nullif(trim(coalesce(_body, '')), '');
  v_link text := nullif(trim(coalesce(_link, '')), '');
  n int;
begin
  perform _require_role('admin');
  if v_title is null or v_body is null then raise exception 'Nhập tiêu đề và nội dung' using errcode = '22023'; end if;
  if length(v_title) > 120 or length(v_body) > 1000 then raise exception 'Tiêu đề tối đa 120, nội dung tối đa 1000 ký tự' using errcode = '22023'; end if;
  if v_link is not null and v_link !~ '^/([^/\\\s][^\s]*)?$' then
    raise exception 'Liên kết phải là trang trong sàn, bắt đầu bằng /' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('admin_broadcast'));   -- tránh bấm gửi hai lần
  if exists (select 1 from broadcasts where title = v_title and body = v_body and created_at > now() - interval '10 minutes') then
    raise exception 'Thông báo giống hệt vừa được gửi trong 10 phút qua' using errcode = '22023';
  end if;
  insert into notifications(user_id, type, title, body, link, data)
    select u, 'broadcast', v_title, v_body, v_link, jsonb_build_object('broadcast_id', v_id) from _broadcast_users(_filter) u;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Không có người nhận nào khớp bộ lọc' using errcode = '22023'; end if;
  insert into broadcasts(id, title, body, link, filter, recipients, sent_by) values (v_id, v_title, v_body, v_link, _filter, n, auth.uid());
  perform _admin_audit('broadcast.sent', 'broadcast', v_id, null, jsonb_build_object('title', v_title, 'recipients', n));
  return n;
end $$;

-- ---------- Tóm tắt buổi sáng cho nhân sự ----------
create or replace function public.staff_daily_digest()
returns int language plpgsql security definer set search_path = public as $$
declare v int; c int; g int; r int; n int := 0;
begin
  select count(*) into v from company_verifications where status = 'pending';
  select count(*) into c from company_claims where status = 'pending';
  select count(*) into g from partner_registrations where status = 'pending';
  select count(*) into r from reports where status in ('open', 'reviewing');
  if v + c + g + r = 0 then return 0; end if;
  insert into notifications(user_id, type, title, body, link)
    select a.user_id, 'staff_digest', format('%s mục đang chờ xử lý', v + c + g + r),
           concat_ws(' · ', case when v > 0 then v || ' xác minh' end, case when c > 0 then c || ' nhận hồ sơ' end,
                     case when g > 0 then g || ' đăng ký đối tác' end, case when r > 0 then r || ' báo cáo' end),
           '/admin'
      from platform_admins a join auth.users u on u.id = a.user_id
     where u.deleted_at is null
       and not exists (select 1 from notifications x where x.user_id = a.user_id and x.type = 'staff_digest' and x.created_at > now() - interval '20 hours');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.staff_daily_digest() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('staff-digest', '0 1 * * *', 'select public.staff_daily_digest()');   -- 08:00 giờ Việt Nam
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_ads()', 'admin_save_ad(uuid, text, text, text, text, uuid, timestamptz, timestamptz)', 'admin_set_ad_status(uuid, text)',
    'admin_broadcast_preview(jsonb)', 'admin_broadcast_send(jsonb, text, text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
