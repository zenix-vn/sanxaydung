-- =============================================================
-- 20261126170000_admin_data_quality.sql
--   Danh mục & tỉnh thành : thêm, sửa, sắp xếp, gộp, xóa danh mục; đổi tên tỉnh
--   Đánh giá              : dấu hiệu nghi ngờ, đánh dấu hợp lệ, doanh nghiệp được phản hồi
--   Chất lượng dữ liệu    : lọc hồ sơ thiếu / trùng / lâu không cập nhật
--   Vá                    : tính lại Trust Score hằng đêm không còn đổi companies.updated_at
-- =============================================================

-- ---------- Vá updated_at ----------
create or replace function public.companies_touch()
returns trigger language plpgsql as $$
declare v_ignore constant text[] := array['updated_at', 'trust_score', 'search_tsv', 'profile_completeness'];
begin
  new.updated_at := case when (to_jsonb(new) - v_ignore) is distinct from (to_jsonb(old) - v_ignore) then now() else old.updated_at end;
  return new;
end $$;
drop trigger if exists t_companies_updated on public.companies;
create trigger t_companies_updated before update on public.companies for each row execute function public.companies_touch();

-- ---------- Danh mục & tỉnh thành ----------
create or replace function public.admin_list_categories()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'group_key', c.group_key, 'parent_id', c.parent_id, 'sort_order', c.sort_order,
      'companies', (select count(*) from company_categories x join companies co on co.id = x.company_id and co.deleted_at is null where x.category_id = c.id),
      'other', (select count(*) from marketplace_listings where category_id = c.id)
             + (select count(*) from projects where category_id = c.id)
             + (select count(*) from services where category_id = c.id),
      'children', (select count(*) from categories k where k.parent_id = c.id))
      order by c.group_key, c.sort_order, c.name), '[]') from categories c);
end $$;

create or replace function public.admin_save_category(_id uuid, _name text, _group text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(trim(coalesce(_name, '')), '');
  v_slug text; v_base text; v_id uuid; i int := 1;
  v_old categories%rowtype;
begin
  perform _require_role('admin');
  if v_name is null then raise exception 'Thiếu tên danh mục' using errcode = '22023'; end if;
  if _group is null or _group not in ('contractor', 'crew', 'supplier', 'service') then raise exception 'Nhóm không hợp lệ' using errcode = '22023'; end if;
  if exists (select 1 from categories where id is distinct from _id and lower(unaccent(name)) = lower(unaccent(v_name))) then
    raise exception 'Đã có danh mục trùng tên' using errcode = '23505';
  end if;
  if _id is null then
    v_base := coalesce(nullif(slugify(v_name), ''), 'danh-muc'); v_slug := v_base;
    while exists (select 1 from categories where slug = v_slug) loop i := i + 1; v_slug := v_base || '-' || i; end loop;
    insert into categories(group_key, slug, name, sort_order)
      values (_group, v_slug, v_name, coalesce((select max(sort_order) from categories where group_key = _group), 0) + 10)
      returning id into v_id;
    perform _admin_audit('category.created', 'category', v_id, null, jsonb_build_object('name', v_name));
  else
    select * into v_old from categories where id = _id for update;
    if not found then raise exception 'Không tìm thấy danh mục' using errcode = 'P0002'; end if;
    -- slug giữ nguyên để không hỏng đường dẫn đã chia sẻ
    update categories set name = v_name, group_key = _group where id = _id;
    v_id := _id;
    perform _admin_audit('category.updated', 'category', v_id, null,
      jsonb_build_object('name', jsonb_build_array(v_old.name, v_name), 'group', jsonb_build_array(v_old.group_key, _group)));
  end if;
  return v_id;
end $$;

-- Đổi chỗ với danh mục liền trên (_up) hoặc liền dưới trong cùng nhóm
create or replace function public.admin_move_category(_id uuid, _up boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_group text; ids uuid[]; i int; j int;
begin
  perform _require_role('admin');
  select group_key into v_group from categories where id = _id;
  if not found then raise exception 'Không tìm thấy danh mục' using errcode = 'P0002'; end if;
  ids := array(select id from categories where group_key = v_group order by sort_order, name for update);
  i := array_position(ids, _id); j := i + case when _up then -1 else 1 end;
  if j < 1 or j > array_length(ids, 1) then return; end if;
  ids[i] := ids[j]; ids[j] := _id;
  update categories c set sort_order = array_position(ids, c.id) * 10 where c.id = any(ids);
end $$;

create or replace function public.admin_merge_categories(_source uuid, _target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s categories%rowtype; t categories%rowtype; n int;
begin
  perform _require_role('admin');
  if _source = _target then raise exception 'Hai danh mục phải khác nhau' using errcode = '22023'; end if;
  select * into s from categories where id = _source for update;
  if not found then raise exception 'Không tìm thấy danh mục nguồn' using errcode = 'P0002'; end if;
  select * into t from categories where id = _target for update;
  if not found then raise exception 'Không tìm thấy danh mục đích' using errcode = 'P0002'; end if;
  if t.parent_id = s.id then update categories set parent_id = s.parent_id where id = t.id; end if;
  update categories set parent_id = t.id where parent_id = s.id and id <> t.id;
  insert into company_categories(company_id, category_id)
    select company_id, t.id from company_categories where category_id = s.id on conflict do nothing;
  get diagnostics n = row_count;
  update marketplace_listings set category_id = t.id where category_id = s.id;
  update projects set category_id = t.id where category_id = s.id;
  update services set category_id = t.id where category_id = s.id;
  -- bản đăng ký đang chờ vẫn tham chiếu slug cũ
  update partner_registrations set category_slugs = array(select distinct case when x = s.slug then t.slug else x end from unnest(category_slugs) x)
   where s.slug = any(category_slugs);
  delete from categories where id = s.id;   -- company_categories của nguồn xóa theo (cascade)
  perform _admin_audit('category.merged', 'category', t.id, null, jsonb_build_object('from', s.name, 'into', t.name, 'companies', n));
end $$;

create or replace function public.admin_delete_category(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  perform _require_role('admin');
  select name into v_name from categories where id = _id for update;
  if not found then raise exception 'Không tìm thấy danh mục' using errcode = 'P0002'; end if;
  if exists (select 1 from company_categories where category_id = _id) or exists (select 1 from marketplace_listings where category_id = _id)
     or exists (select 1 from projects where category_id = _id) or exists (select 1 from services where category_id = _id)
     or exists (select 1 from categories where parent_id = _id) then
    raise exception 'Danh mục đang được dùng — hãy gộp vào danh mục khác' using errcode = '22023';
  end if;
  delete from categories where id = _id;
  perform _admin_audit('category.deleted', 'category', _id, null, jsonb_build_object('name', v_name));
end $$;

create or replace function public.admin_rename_province(_code text, _name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_name text := nullif(trim(coalesce(_name, '')), '');
begin
  perform _require_role('admin');
  if v_name is null then raise exception 'Thiếu tên tỉnh/thành' using errcode = '22023'; end if;
  if exists (select 1 from provinces where code <> _code and lower(unaccent(name)) = lower(unaccent(v_name))) then
    raise exception 'Đã có tỉnh/thành trùng tên' using errcode = '23505';
  end if;
  select name into v_old from provinces where code = _code for update;
  if not found then raise exception 'Không tìm thấy tỉnh/thành' using errcode = 'P0002'; end if;
  update provinces set name = v_name where code = _code;
  perform _admin_audit('province.renamed', 'province', gen_random_uuid(), null, jsonb_build_object('code', _code, 'name', jsonb_build_array(v_old, v_name)));
end $$;

-- ---------- Đánh giá ----------
alter table public.reviews add column if not exists reply text;
alter table public.reviews add column if not exists replied_at timestamptz;

-- Dấu vết nội bộ của lượt đánh giá (không công khai)
create table if not exists public.review_signals (
  review_id  uuid primary key references public.reviews(id) on delete cascade,
  user_id    uuid,
  ip         text,
  cleared_at timestamptz,
  cleared_by uuid references public.profiles(id) on delete set null
);
alter table public.review_signals enable row level security;
revoke all on public.review_signals from anon, authenticated;

create or replace function public.trg_review_signal()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_headers json;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then v_headers := null;
  end;
  insert into review_signals(review_id, user_id, ip)
    values (new.id, auth.uid(), nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1)), ''))
    on conflict (review_id) do nothing;
  return null;
end $$;
drop trigger if exists t_review_signal on public.reviews;
create trigger t_review_signal after insert on public.reviews for each row execute function public.trg_review_signal();

create or replace function public.reply_review(_review uuid, _reply text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_reply text := nullif(trim(coalesce(_reply, '')), ''); v_first boolean; v_reviewer uuid;
begin
  select target_company_id, reviewer_company_id, reply is null into v_company, v_reviewer, v_first
    from reviews where id = _review and status = 'published' for update;
  if not found then raise exception 'Không tìm thấy đánh giá' using errcode = 'P0002'; end if;
  if not is_company_member(v_company, 'admin') then
    raise exception 'Chỉ chủ hoặc quản trị của doanh nghiệp được phản hồi' using errcode = '42501';
  end if;
  if length(v_reply) > 2000 then raise exception 'Phản hồi tối đa 2000 ký tự' using errcode = '22023'; end if;
  update reviews set reply = v_reply, replied_at = case when v_reply is null then null else now() end where id = _review;
  if v_first and v_reply is not null then
    perform notify_company(v_reviewer, 'review_reply', 'Đánh giá của bạn đã được phản hồi',
      (select name from companies where id = v_company) || ' đã trả lời đánh giá.',
      '/cong-ty/' || (select slug from companies where id = v_company) || '#danhgia', jsonb_build_object('review_id', _review));
  end if;
end $$;

create or replace function public.admin_reviews(_tab text default 'suspicious', _limit int default 20, _offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('moderator');
  return (
    with s as (
      select r.*, g.ip, g.cleared_at, a.name as reviewer_name, b.name as target_name,
        array_remove(array[
          case when exists (select 1 from company_members x join company_members y on y.user_id = x.user_id and y.company_id = r.target_company_id and y.status = 'active'
                             where x.company_id = r.reviewer_company_id and x.status = 'active')
               then 'Một người thuộc cả hai doanh nghiệp' end,
          case when g.ip is not null and exists (select 1 from review_signals o join reviews q on q.id = o.review_id
                             where o.ip = g.ip and o.review_id <> r.id and q.reviewer_company_id <> r.reviewer_company_id)
               then 'Cùng địa chỉ IP với đánh giá của doanh nghiệp khác' end,
          case when a.created_at > r.created_at - interval '14 days' then 'Doanh nghiệp đánh giá mới tạo dưới 14 ngày' end,
          case when (select count(*) from reviews q where q.reviewer_company_id = r.reviewer_company_id
                      and q.created_at between r.created_at - interval '7 days' and r.created_at + interval '7 days') >= 3
               then 'Viết từ 3 đánh giá trong vài ngày' end,
          case when exists (select 1 from reviews q where q.reviewer_company_id = r.target_company_id and q.target_company_id = r.reviewer_company_id
                             and q.overall >= 4.5 and r.overall >= 4.5) then 'Hai bên chấm điểm cao cho nhau' end,
          case when exists (select 1 from connections k where k.id = r.connection_id and k.completed_at < k.created_at + interval '1 day')
               then 'Kết nối hoàn tất trong chưa đầy 1 ngày' end,
          case when r.overall in (1, 5) and nullif(trim(r.comment), '') is null then 'Điểm tuyệt đối, không lời bình' end
        ], null) as flags
        from reviews r
        left join review_signals g on g.review_id = r.id
        left join companies a on a.id = r.reviewer_company_id
        left join companies b on b.id = r.target_company_id
    ),
    t as (select s.*, (cardinality(flags) > 0 and cleared_at is null and status <> 'hidden') as suspicious from s),
    page as (
      select * from t
       where case _tab when 'suspicious' then suspicious when 'hidden' then status = 'hidden' else true end
       order by created_at desc limit least(_limit, 100) offset greatest(_offset, 0)
    )
    select jsonb_build_object(
      'counts', (select jsonb_build_object('suspicious', count(*) filter (where suspicious), 'hidden', count(*) filter (where status = 'hidden'), 'all', count(*)) from t),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'overall', p.overall, 'comment', p.comment, 'reply', p.reply, 'status', p.status, 'created_at', p.created_at,
          'reviewer_id', p.reviewer_company_id, 'reviewer', p.reviewer_name, 'target_id', p.target_company_id, 'target', p.target_name,
          'flags', to_jsonb(p.flags), 'suspicious', p.suspicious, 'cleared', p.cleared_at is not null) order by p.created_at desc), '[]') from page p)));
end $$;

create or replace function public.admin_clear_review(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  perform _require_role('moderator');
  select target_company_id into v_company from reviews where id = _id;
  if not found then raise exception 'Không tìm thấy đánh giá' using errcode = 'P0002'; end if;
  insert into review_signals(review_id, cleared_at, cleared_by) values (_id, now(), auth.uid())
    on conflict (review_id) do update set cleared_at = now(), cleared_by = auth.uid();
  perform _admin_audit('moderation.review_cleared', 'review', _id, v_company, '{}');
end $$;

-- ---------- Chất lượng dữ liệu ----------
create or replace function public.admin_quality(_issue text default 'dup_phone', _limit int default 20, _offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return (
    with c as (
      select co.*, normalize_phone(co.phone) as np, nullif(regexp_replace(coalesce(co.tax_code, ''), '\s', '', 'g'), '') as tx
        from companies co where co.deleted_at is null
    ),
    dp as (select np from c where np is not null group by np having count(*) > 1),
    dt as (select tx from c where tx is not null group by tx having count(*) > 1),
    f as (
      select c.*,
        c.np in (select np from dp) as dup_phone,
        c.tx in (select tx from dt) as dup_tax,
        (c.np is null or c.np !~ '^0\d{8,10}$') as bad_phone,
        not exists (select 1 from company_categories k where k.company_id = c.id) as no_category,
        (c.province_code is null and not exists (select 1 from company_locations l where l.company_id = c.id)) as no_location,
        (nullif(trim(c.intro), '') is null and nullif(trim(c.description), '') is null) as no_intro,
        c.logo_url is null as no_logo,
        c.updated_at < now() - interval '180 days' as stale
      from c
    ),
    flag as (
      select f.*, case _issue
          when 'dup_phone' then coalesce(dup_phone, false) when 'dup_tax' then coalesce(dup_tax, false) when 'bad_phone' then bad_phone
          when 'no_category' then no_category when 'no_location' then no_location when 'no_intro' then no_intro
          when 'no_logo' then no_logo when 'stale' then stale else false end as hit
        from f
    ),
    page as (
      select * from flag where hit
       order by case when _issue = 'dup_phone' then np when _issue = 'dup_tax' then tx end,
                case when _issue = 'stale' then updated_at end, name
       limit least(_limit, 100) offset greatest(_offset, 0)
    )
    select jsonb_build_object(
      'total', (select count(*) from f),
      'counts', (select jsonb_build_object(
          'dup_phone', count(*) filter (where dup_phone), 'dup_tax', count(*) filter (where dup_tax), 'bad_phone', count(*) filter (where bad_phone),
          'no_category', count(*) filter (where no_category), 'no_location', count(*) filter (where no_location),
          'no_intro', count(*) filter (where no_intro), 'no_logo', count(*) filter (where no_logo), 'stale', count(*) filter (where stale)) from f),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'name', p.name, 'logo_url', p.logo_url, 'phone', p.phone, 'tax_code', p.tax_code, 'status', p.status,
          'has_owner', p.owner_id is not null, 'completeness', p.profile_completeness, 'updated_at', p.updated_at)
          order by case when _issue = 'dup_phone' then p.np when _issue = 'dup_tax' then p.tx end,
                   case when _issue = 'stale' then p.updated_at end, p.name), '[]') from page p)));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_categories()', 'admin_save_category(uuid, text, text)', 'admin_move_category(uuid, boolean)',
    'admin_merge_categories(uuid, uuid)', 'admin_delete_category(uuid)', 'admin_rename_province(text, text)',
    'reply_review(uuid, text)', 'admin_reviews(text, int, int)', 'admin_clear_review(uuid)', 'admin_quality(text, int, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
