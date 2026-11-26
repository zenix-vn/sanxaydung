-- =============================================================
-- Số liệu công khai cho bản đồ (/ban-do) và trang SEO lĩnh vực × tỉnh (/linh-vuc/...)
-- security invoker: chỉ đếm hồ sơ published mà khách vãng lai thấy được.
-- =============================================================

-- Số doanh nghiệp theo tỉnh (trụ sở hoặc khu vực hoạt động)
create or replace function public.province_stats()
returns jsonb language sql stable set search_path = public as $$
  with cp as (
    select c.id, c.verified_tier, c.province_code as code from companies c
     where c.status = 'published' and c.deleted_at is null and c.province_code is not null
    union
    select c.id, c.verified_tier, l.province_code from companies c join company_locations l on l.company_id = c.id
     where c.status = 'published' and c.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', v.code, 'name', v.name, 'total', s.total, 'verified', s.verified)
                            order by s.total desc, v.name), '[]')
    from (select code, count(distinct id) as total, count(distinct id) filter (where verified_tier <> 'none') as verified
            from cp group by code) s
    join provinces v on v.code = s.code;
$$;

-- Các cặp (nhóm lĩnh vực cha, tỉnh) có ít nhất 1 doanh nghiệp — cho sitemap & liên kết nội bộ
create or replace function public.landing_pairs()
returns jsonb language sql stable set search_path = public as $$
  with cc as (
    select distinct c.id, coalesce(ct.parent_id, ct.id) as cat
      from companies c
      join company_categories x on x.company_id = c.id
      join categories ct on ct.id = x.category_id
     where c.status = 'published' and c.deleted_at is null
  ),
  cp as (
    select c.id, c.province_code as code from companies c
     where c.status = 'published' and c.deleted_at is null and c.province_code is not null
    union
    select l.company_id, l.province_code from company_locations l
  )
  select coalesce(jsonb_agg(jsonb_build_object('category', k.slug, 'category_name', k.name, 'province', v.code, 'province_name', v.name, 'total', t.total)
                            order by t.total desc), '[]')
    from (select cc.cat, cp.code, count(distinct cc.id) as total from cc join cp on cp.id = cc.id group by cc.cat, cp.code) t
    join categories k on k.id = t.cat
    join provinces v on v.code = t.code;
$$;

grant execute on function public.province_stats() to anon, authenticated;
grant execute on function public.landing_pairs() to anon, authenticated;
