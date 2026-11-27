-- =============================================================
-- 20261130100000_site_leads.sql
-- Website doanh nghiệp (bước 2): yêu cầu báo giá gửi từ form trên website.
--   - site_leads: khách để lại tên, SĐT, nhu cầu; thành viên doanh nghiệp xem và cập nhật trạng thái.
--   - submit_site_lead(): anon gọi được; kiểm tra dữ liệu, chống gửi dồn, báo cho chủ/quản trị.
--   - company_stats_daily: thêm site_views (lượt xem website) và leads (số yêu cầu).
-- =============================================================

create table if not exists public.site_leads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 100),
  phone       text not null check (phone ~ '^0[0-9]{9,10}$'),
  email       text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  need        text not null default 'quote' check (need in ('quote', 'consult', 'other')),
  message     text check (message is null or char_length(message) <= 2000),
  source_path text check (source_path is null or char_length(source_path) <= 300),
  status      text not null default 'new' check (status in ('new', 'contacted', 'done', 'spam')),
  note        text check (note is null or char_length(note) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists site_leads_company_idx on public.site_leads (company_id, created_at desc);
create index if not exists site_leads_phone_idx on public.site_leads (company_id, phone, created_at desc);

alter table public.site_leads enable row level security;
drop policy if exists site_leads_read on public.site_leads;
create policy site_leads_read on public.site_leads for select
  using (public.is_company_member(company_id, 'editor') or public.has_platform_role('moderator'));
drop policy if exists site_leads_update on public.site_leads;
create policy site_leads_update on public.site_leads for update
  using (public.is_company_member(company_id, 'editor'))
  with check (public.is_company_member(company_id, 'editor'));

revoke all on public.site_leads from anon, authenticated;
grant select on public.site_leads to authenticated;
-- chỉ được sửa trạng thái và ghi chú; thêm mới phải qua submit_site_lead()
grant update (status, note) on public.site_leads to authenticated;
grant all on public.site_leads to service_role;

create or replace function public.site_leads_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists t_site_leads_touch on public.site_leads;
create trigger t_site_leads_touch before update on public.site_leads
  for each row execute function public.site_leads_touch();

-- ---------- Thống kê ----------
alter table public.company_stats_daily
  add column if not exists site_views int not null default 0,
  add column if not exists leads int not null default 0;

create or replace function public.track_company(_company uuid, _kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _kind not in ('view', 'contact', 'site_view') then return; end if;
  if auth.uid() is not null and is_company_member(_company) then return; end if;
  if not exists (select 1 from companies where id = _company and status = 'published' and deleted_at is null) then return; end if;
  insert into company_stats_daily(company_id, day, views, contacts, site_views)
    values (_company, current_date, (_kind = 'view')::int, (_kind = 'contact')::int, (_kind = 'site_view')::int)
  on conflict (company_id, day) do update
    set views      = company_stats_daily.views      + excluded.views,
        contacts   = company_stats_daily.contacts   + excluded.contacts,
        site_views = company_stats_daily.site_views + excluded.site_views;
end $$;
revoke execute on function public.track_company(uuid, text) from public;
grant  execute on function public.track_company(uuid, text) to anon, authenticated;

-- ---------- Gửi yêu cầu ----------
create or replace function public.submit_site_lead(
  _company uuid, _name text, _phone text, _email text, _need text, _message text, _path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(_phone, ''), '[^0-9+]', '', 'g');
  v_name  text := btrim(coalesce(_name, ''));
  v_email text := nullif(lower(btrim(coalesce(_email, ''))), '');
  v_msg   text := nullif(btrim(coalesce(_message, '')), '');
  v_need  text := coalesce(nullif(_need, ''), 'quote');
  v_co    record;
  v_id    uuid;
begin
  if v_phone like '+84%' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone like '84%' and char_length(v_phone) >= 11 then v_phone := '0' || substr(v_phone, 3); end if;

  select id, name into v_co from companies
   where id = _company and status = 'published' and deleted_at is null
     and coalesce((site_settings ->> 'enabled')::boolean, true);
  if not found then
    raise exception 'Doanh nghiệp không nhận yêu cầu qua website' using errcode = 'P0002';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Vui lòng nhập họ tên' using errcode = '22023';
  end if;
  if v_phone !~ '^0[0-9]{9,10}$' then
    raise exception 'Số điện thoại không hợp lệ' using errcode = '22023';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email không hợp lệ' using errcode = '22023';
  end if;
  if v_need not in ('quote', 'consult', 'other') then v_need := 'other'; end if;

  -- Chống gửi dồn: cùng SĐT tới cùng doanh nghiệp tối đa 1 lần / 10 phút; mỗi doanh nghiệp tối đa 30 / giờ
  if exists (select 1 from site_leads where company_id = _company and phone = v_phone and created_at > now() - interval '10 minutes') then
    raise exception 'Bạn vừa gửi yêu cầu, doanh nghiệp sẽ sớm liên hệ lại' using errcode = '54000';
  end if;
  if (select count(*) from site_leads where company_id = _company and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Hệ thống đang nhận quá nhiều yêu cầu, vui lòng gọi điện trực tiếp' using errcode = '54000';
  end if;

  insert into site_leads(company_id, name, phone, email, need, message, source_path)
    values (_company, v_name, v_phone, v_email, v_need, left(v_msg, 2000), left(nullif(_path, ''), 300))
    returning id into v_id;

  insert into company_stats_daily(company_id, day, leads) values (_company, current_date, 1)
  on conflict (company_id, day) do update set leads = company_stats_daily.leads + 1;

  perform notify_company(_company, 'site_lead', 'Yêu cầu báo giá mới từ website',
    v_name || ' · ' || v_phone || coalesce(' — ' || left(v_msg, 120), ''), '/dashboard/leads',
    jsonb_build_object('lead_id', v_id));
  return v_id;
end $$;
revoke execute on function public.submit_site_lead(uuid, text, text, text, text, text, text) from public;
grant  execute on function public.submit_site_lead(uuid, text, text, text, text, text, text) to anon, authenticated;
