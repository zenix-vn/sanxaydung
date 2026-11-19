-- =============================================================
-- 20261119093000_search_groups_home_stats.sql
-- 1. search_companies: lọc theo NHÓM (_group) và danh mục cha bao gồm danh mục con.
--    Trước đây /directory?group=... lấy 1 danh mục bất kỳ trong nhóm (thường là danh mục cha
--    không gắn công ty nào) → luôn trả 0 kết quả.
-- 2. home_stats(): số liệu THẬT cho trang chủ (1 truy vấn, công khai).
-- =============================================================

drop function if exists public.search_companies(text, uuid, text, boolean, int, int);

create or replace function public.search_companies(
  q text default null,
  _category uuid default null,
  _province text default null,
  _verified_only boolean default false,
  _limit int default 20,
  _offset int default 0,
  _group text default null)
returns setof public.companies language sql stable set search_path = public as $$
  select c.* from public.companies c
  where c.status = 'published' and c.deleted_at is null
    and (q is null or c.search_tsv @@ websearch_to_tsquery('public.vn', q))
    and (_province is null or exists (select 1 from company_locations l
          where l.company_id = c.id and l.province_code = _province))
    and (_category is null or exists (select 1 from company_categories cc
          join categories ct on ct.id = cc.category_id
          where cc.company_id = c.id and (ct.id = _category or ct.parent_id = _category)))
    and (_group is null or exists (select 1 from company_categories cc
          join categories ct on ct.id = cc.category_id
          where cc.company_id = c.id and ct.group_key = _group))
    and (not _verified_only or c.verified_tier <> 'none')
  order by
    ts_rank(c.search_tsv, websearch_to_tsquery('public.vn', coalesce(q, ''))) desc,
    c.trust_score desc,
    c.name
  limit _limit offset _offset;
$$;
grant execute on function public.search_companies(text, uuid, text, boolean, int, int, text) to anon, authenticated, service_role;

create or replace function public.home_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  with pub as (select id, verified_tier from companies where status = 'published' and deleted_at is null)
  select jsonb_build_object(
    'companies',  (select count(*) from pub),
    'verified',   (select count(*) from pub where verified_tier <> 'none'),
    'provinces',  (select count(distinct l.province_code) from company_locations l join pub on pub.id = l.company_id),
    'projects',   (select count(*) from projects p join pub on pub.id = p.company_id),
    'listings',   (select count(*) from marketplace_listings where status = 'open' and deleted_at is null),
    'groups', (select coalesce(jsonb_object_agg(g, n), '{}') from (
        select ct.group_key g, count(distinct cc.company_id) n
          from company_categories cc join categories ct on ct.id = cc.category_id join pub on pub.id = cc.company_id
         group by ct.group_key) x),
    'top_categories', (select coalesce(jsonb_agg(x order by x.n desc, x.name), '[]') from (
        select ct.slug, ct.name, ct.group_key, count(distinct cc.company_id) n
          from company_categories cc join categories ct on ct.id = cc.category_id join pub on pub.id = cc.company_id
         where ct.parent_id is not null
         group by ct.slug, ct.name, ct.group_key
        having count(distinct cc.company_id) > 0
         order by n desc limit 12) x),
    'top_provinces', (select coalesce(jsonb_agg(x order by x.n desc, x.name), '[]') from (
        select p.code, p.name, count(distinct l.company_id) n
          from company_locations l join provinces p on p.code = l.province_code join pub on pub.id = l.company_id
         group by p.code, p.name
         order by n desc, p.name limit 12) x)
  );
$$;
grant execute on function public.home_stats() to anon, authenticated, service_role;
