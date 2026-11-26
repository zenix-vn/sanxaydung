-- =============================================================
-- Thống kê hồ sơ doanh nghiệp theo ngày (/dashboard/stats)
--   views       : lượt xem trang /cong-ty/[slug]
--   contacts    : bấm gọi / email / website / nhắn tin trên hồ sơ
--   impressions : xuất hiện trong kết quả danh bạ
-- Ghi qua RPC (anon được gọi); không đếm khi người xem là thành viên công ty đó.
-- Bộ đếm có thể bị thổi phồng bởi client cố ý — chỉ dùng tham khảo, không dùng tính tiền.
-- =============================================================
create table if not exists public.company_stats_daily (
  company_id  uuid not null references public.companies(id) on delete cascade,
  day         date not null default current_date,
  views       int not null default 0,
  contacts    int not null default 0,
  impressions int not null default 0,
  primary key (company_id, day)
);

alter table public.company_stats_daily enable row level security;
drop policy if exists csd_read on public.company_stats_daily;
create policy csd_read on public.company_stats_daily for select
  using (public.is_company_member(company_id) or public.has_platform_role('moderator'));
revoke all on public.company_stats_daily from anon, authenticated;
grant select on public.company_stats_daily to authenticated;
grant all on public.company_stats_daily to service_role;

create or replace function public.track_company(_company uuid, _kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _kind not in ('view', 'contact') then return; end if;
  if auth.uid() is not null and is_company_member(_company) then return; end if;
  if not exists (select 1 from companies where id = _company and status = 'published' and deleted_at is null) then return; end if;
  insert into company_stats_daily(company_id, day, views, contacts)
    values (_company, current_date, (_kind = 'view')::int, (_kind = 'contact')::int)
  on conflict (company_id, day) do update
    set views    = company_stats_daily.views    + excluded.views,
        contacts = company_stats_daily.contacts + excluded.contacts;
end $$;
revoke execute on function public.track_company(uuid, text) from public;
grant  execute on function public.track_company(uuid, text) to anon, authenticated;

create or replace function public.track_impressions(_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if _ids is null or cardinality(_ids) = 0 then return; end if;
  insert into company_stats_daily(company_id, day, impressions)
    select c.id, current_date, 1
      from companies c
     where c.id = any(_ids[1:50]) and c.status = 'published' and c.deleted_at is null
       and not (auth.uid() is not null and is_company_member(c.id))
  on conflict (company_id, day) do update
    set impressions = company_stats_daily.impressions + 1;
end $$;
revoke execute on function public.track_impressions(uuid[]) from public;
grant  execute on function public.track_impressions(uuid[]) to anon, authenticated;
