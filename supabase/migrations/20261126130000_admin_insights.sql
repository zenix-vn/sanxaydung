-- =============================================================
-- 20261126130000_admin_insights.sql
-- Số liệu cho biểu đồ trang Tổng quan quản trị. Tuần tính theo giờ Việt Nam,
-- bắt đầu từ thứ Hai. Số thuê bao trả phí chỉ trả cho quản trị viên trở lên.
-- =============================================================

create or replace function public.admin_insights(_weeks int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tz   constant text := 'Asia/Ho_Chi_Minh';
  v_n    int := least(greatest(coalesce(_weeks, 12), 4), 52);
  v_this date := date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform _require_role('moderator');
  return jsonb_build_object(
    'weeks', (
      with w as (select v_this - 7 * i as week from generate_series(0, v_n - 1) i),
      u as (select date_trunc('week', created_at at time zone v_tz)::date as week, count(*) n from profiles group by 1),
      c as (select date_trunc('week', created_at at time zone v_tz)::date as week, count(*) n from companies where deleted_at is null group by 1),
      v as (select date_trunc('week', verified_at at time zone v_tz)::date as week, count(distinct company_id) n
              from company_verifications where status = 'verified' and verified_at is not null group by 1),
      q as (select date_trunc('week', created_at at time zone v_tz)::date as week, count(*) n from quotes group by 1)
      select jsonb_agg(jsonb_build_object('week', to_char(w.week, 'YYYY-MM-DD'),
               'users', coalesce(u.n, 0), 'companies', coalesce(c.n, 0), 'verified', coalesce(v.n, 0), 'quotes', coalesce(q.n, 0))
             order by w.week)
        from w left join u using (week) left join c using (week) left join v using (week) left join q using (week)),
    'funnel', (
      select jsonb_build_object(
               'total', count(*),
               'claimed', count(*) filter (where owner_id is not null),
               'verified', count(*) filter (where verified_tier <> 'none'),
               'paid', case when has_platform_role('admin') then
                         (select count(distinct s.company_id) from subscriptions s
                            join companies cc on cc.id = s.company_id and cc.deleted_at is null
                           where s.status = 'active' and (s.expires_at is null or s.expires_at > now())
                             and s.plan_id in (select id from plans where price_month > 0)) end)
        from companies where deleted_at is null),
    'registrations', (
      select jsonb_build_object(
               'total', count(*),
               'pending', count(*) filter (where status = 'pending'),
               'approved', count(*) filter (where status = 'approved'))
        from partner_registrations),
    'provinces', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'n', x.n) order by x.n desc, x.name), '[]') from (
        select p.name, count(distinct l.company_id) n
          from company_locations l
          join provinces p on p.code = l.province_code
          join companies c on c.id = l.company_id and c.deleted_at is null
         group by p.name order by n desc, p.name limit 10) x),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'n', x.n) order by x.n desc, x.name), '[]') from (
        select ca.name, count(distinct cc.company_id) n
          from company_categories cc
          join categories ca on ca.id = cc.category_id
          join companies c on c.id = cc.company_id and c.deleted_at is null
         group by ca.name order by n desc, ca.name limit 10) x),
    'no_location', (select count(*) from companies c where deleted_at is null
                      and not exists (select 1 from company_locations l where l.company_id = c.id)),
    'no_category', (select count(*) from companies c where deleted_at is null
                      and not exists (select 1 from company_categories k where k.company_id = c.id)));
end $$;

revoke execute on function public.admin_insights(int) from public, anon;
grant  execute on function public.admin_insights(int) to authenticated;
