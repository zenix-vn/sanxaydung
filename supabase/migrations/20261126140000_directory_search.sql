-- =============================================================
-- 20261126140000_directory_search.sql
-- Trang danh bạ cần: TỔNG số kết quả, tên tỉnh, lĩnh vực và điểm đánh giá thật, sắp xếp được.
-- security invoker: chỉ thấy đúng những gì RLS cho người gọi (khách vãng lai) thấy.
-- =============================================================

create or replace function public.directory_search(
  q text default null, _category uuid default null, _province text default null,
  _verified_only boolean default false, _group text default null,
  _sort text default 'trust', _limit int default 20, _offset int default 0)
returns jsonb language sql stable set search_path = public as $$
  with hit as (
    select c.*,
           case when q is null then 0 else ts_rank(c.search_tsv, websearch_to_tsquery('public.vn', q)) end as rank
      from companies c
     where c.status = 'published' and c.deleted_at is null
       and (q is null or c.search_tsv @@ websearch_to_tsquery('public.vn', q))
       and (_province is null or c.province_code = _province
            or exists (select 1 from company_locations l where l.company_id = c.id and l.province_code = _province))
       and (_category is null or exists (select 1 from company_categories cc join categories ct on ct.id = cc.category_id
             where cc.company_id = c.id and (ct.id = _category or ct.parent_id = _category)))
       and (_group is null or exists (select 1 from company_categories cc join categories ct on ct.id = cc.category_id
             where cc.company_id = c.id and ct.group_key = _group))
       and (not _verified_only or c.verified_tier <> 'none')
  ),
  stat as (
    select h.id,
           (select round(avg(r.overall), 1) from reviews r where r.target_company_id = h.id and r.status = 'published') as rating,
           (select count(*) from reviews r where r.target_company_id = h.id and r.status = 'published') as review_count,
           (select count(*) from projects p where p.company_id = h.id) as project_count
      from hit h
  ),
  page as (
    select h.*, s.rating, s.review_count, s.project_count,
           row_number() over (order by
             case when _sort = 'rating' then s.rating end desc nulls last,
             case when _sort = 'rating' then s.review_count end desc nulls last,
             case when _sort = 'projects' then s.project_count end desc nulls last,
             case when _sort = 'updated' then h.updated_at end desc nulls last,
             h.rank desc, h.trust_score desc, h.name) as rn
      from hit h join stat s on s.id = h.id
     order by rn
     limit least(greatest(_limit, 1), 50) offset greatest(_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from hit),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'slug', p.slug, 'name', p.name, 'logo_url', p.logo_url, 'intro', p.intro,
        'verified_tier', p.verified_tier, 'trust_score', p.trust_score, 'size_range', p.size_range, 'founded_year', p.founded_year,
        'province', coalesce(
            (select v.name from provinces v where v.code = p.province_code),
            (select v.name from company_locations l join provinces v on v.code = l.province_code
              where l.company_id = p.id order by (l.province_code = _province) desc nulls last, v.name limit 1)),
        'location_count', (select count(*) from company_locations l where l.company_id = p.id),
        'categories', (select coalesce(jsonb_agg(x.name), '[]') from (
            select ct.name from company_categories cc join categories ct on ct.id = cc.category_id
             where cc.company_id = p.id order by ct.sort_order, ct.name limit 3) x),
        'category_count', (select count(*) from company_categories cc where cc.company_id = p.id),
        'rating', p.rating, 'review_count', p.review_count) order by p.rn), '[]') from page p));
$$;
grant execute on function public.directory_search(text, uuid, text, boolean, text, text, int, int) to anon, authenticated, service_role;
