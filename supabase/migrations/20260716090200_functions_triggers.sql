-- =============================================================
-- 20260716090200_functions_triggers.sql
-- Helper bảo mật, trigger (updated_at, tsvector, overall), RPC nghiệp vụ
-- =============================================================

-- ---------- Helper bảo mật (dùng trong RLS) ----------
create or replace function public.is_company_member(_company_id uuid, _min_role text default 'member')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = _company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and (
        _min_role = 'member'
        or (_min_role = 'editor' and cm.role in ('owner','admin','editor'))
        or (_min_role = 'admin'  and cm.role in ('owner','admin'))
        or (_min_role = 'owner'  and cm.role = 'owner')
      )
  );
$$;

create or replace function public.has_connection(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
    where c.status = 'completed'
      and ((c.requester_company_id=_a and c.target_company_id=_b)
        or (c.requester_company_id=_b and c.target_company_id=_a))
  );
$$;

-- ---------- Trigger auth.users -> profiles ----------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trigger updated_at ----------
create trigger t_profiles_updated  before update on public.profiles              for each row execute function public.set_updated_at();
create trigger t_companies_updated before update on public.companies             for each row execute function public.set_updated_at();
create trigger t_projects_updated  before update on public.projects              for each row execute function public.set_updated_at();
create trigger t_posts_updated     before update on public.posts                 for each row execute function public.set_updated_at();
create trigger t_listings_updated  before update on public.marketplace_listings  for each row execute function public.set_updated_at();

-- ---------- Trigger tsvector (FTS tiếng Việt) ----------
create or replace function public.companies_tsv() returns trigger
language plpgsql as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('public.vn', coalesce(new.name,'')),        'A')
   || setweight(to_tsvector('public.vn', coalesce(new.intro,'')),       'B')
   || setweight(to_tsvector('public.vn', coalesce(new.description,'')), 'C');
  return new;
end $$;
create trigger t_companies_tsv before insert or update
  on public.companies for each row execute function public.companies_tsv();

create or replace function public.posts_tsv() returns trigger
language plpgsql as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('public.vn', coalesce(new.title,'')), 'A')
   || setweight(to_tsvector('public.vn', coalesce(new.body,'')),  'B');
  return new;
end $$;
create trigger t_posts_tsv before insert or update
  on public.posts for each row execute function public.posts_tsv();

create or replace function public.listings_tsv() returns trigger
language plpgsql as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('public.vn', coalesce(new.title,'')),       'A')
   || setweight(to_tsvector('public.vn', coalesce(new.description,'')), 'B');
  return new;
end $$;
create trigger t_listings_tsv before insert or update
  on public.marketplace_listings for each row execute function public.listings_tsv();

-- ---------- Trigger tính overall của review ----------
create or replace function public.reviews_overall() returns trigger
language plpgsql as $$
begin
  new.overall := round((
      coalesce(new.score_quality,0)     + coalesce(new.score_progress,0)
    + coalesce(new.score_cost,0)        + coalesce(new.score_cooperation,0)
    + coalesce(new.score_safety,0)      + coalesce(new.score_warranty,0)
  )::numeric / nullif((
      (new.score_quality is not null)::int + (new.score_progress is not null)::int
    + (new.score_cost is not null)::int    + (new.score_cooperation is not null)::int
    + (new.score_safety is not null)::int  + (new.score_warranty is not null)::int
  ),0), 2);
  return new;
end $$;
create trigger t_reviews_overall before insert or update
  on public.reviews for each row execute function public.reviews_overall();

-- ---------- Trigger đếm quote_count ----------
create or replace function public.bump_quote_count() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.marketplace_listings set quote_count = quote_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.marketplace_listings set quote_count = greatest(quote_count - 1,0) where id = old.listing_id;
  end if;
  return null;
end $$;
create trigger t_quote_count after insert or delete
  on public.quotes for each row execute function public.bump_quote_count();

-- ---------- Trust Score Engine ----------
create or replace function public.compute_trust_score(_company uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_verify   numeric := 0;
  v_reviews  numeric := 0;
  v_projects numeric := 0;
  v_complete numeric := 0;
  v_total    numeric := 0;
  b jsonb;
begin
  select case
    when exists(select 1 from company_verifications where company_id=_company
                and kind='capability_cert' and status='verified') then 20
    when exists(select 1 from company_verifications where company_id=_company
                and kind in ('tax','business_license') and status='verified') then 14
    else 0 end into v_verify;

  select coalesce(avg(overall),0)/5*30 into v_reviews
    from reviews where target_company_id=_company and status='published';

  select least(count(*)*2,15) into v_projects from projects where company_id=_company;

  select coalesce(profile_completeness,0)::numeric/100*10 into v_complete
    from companies where id=_company;

  v_total := v_verify + v_reviews + v_projects + v_complete;

  b := jsonb_build_object(
        'verification', v_verify,
        'reviews',      round(v_reviews,1),
        'projects',     v_projects,
        'completeness', round(v_complete,1));

  insert into trust_scores(company_id, score, breakdown, computed_at)
    values (_company, round(v_total,2), b, now())
  on conflict (company_id) do update
    set score=excluded.score, breakdown=excluded.breakdown, computed_at=now();

  insert into trust_score_history(company_id, score, breakdown)
    values (_company, round(v_total,2), b);

  update companies set trust_score=round(v_total,2) where id=_company;
  return round(v_total,2);
end $$;

-- ---------- Tìm kiếm doanh nghiệp ----------
create or replace function public.search_companies(
  q text default null,
  _category uuid default null,
  _province text default null,
  _verified_only boolean default false,
  _limit int default 20,
  _offset int default 0)
returns setof public.companies language sql stable set search_path = public as $$
  select c.* from public.companies c
  where c.status='published' and c.deleted_at is null
    and (q is null or c.search_tsv @@ websearch_to_tsquery('public.vn', q))
    and (_province is null or exists (select 1 from company_locations l
          where l.company_id=c.id and l.province_code=_province))
    and (_category is null or exists (select 1 from company_categories cc
          where cc.company_id=c.id and cc.category_id=_category))
    and (not _verified_only or c.verified_tier <> 'none')
  order by
    ts_rank(c.search_tsv, websearch_to_tsquery('public.vn', coalesce(q,''))) desc,
    c.trust_score desc
  limit _limit offset _offset;
$$;

-- ---------- RPC nghiệp vụ ----------
create or replace function public.create_connection(
  _target uuid, _as_company uuid, _listing uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_as_company,'editor') then
    raise exception 'Không có quyền đại diện công ty' using errcode='42501';
  end if;
  insert into connections(requester_company_id, target_company_id, listing_id)
    values (_as_company, _target, _listing) returning id into v_id;
  return v_id;
end $$;

create or replace function public.complete_connection(_connection uuid, _as_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company,'admin') then
    raise exception 'Chỉ admin/owner được xác nhận hoàn tất' using errcode='42501';
  end if;
  update connections set status='completed', completed_at=now()
   where id=_connection
     and (requester_company_id=_as_company or target_company_id=_as_company);
end $$;

create or replace function public.submit_review(
  _connection uuid, _reviewer uuid, _target uuid,
  _quality int, _progress int, _cost int, _cooperation int, _safety int, _warranty int,
  _comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_reviewer,'admin') then
    raise exception 'Không có quyền đánh giá thay công ty' using errcode='42501';
  end if;
  if not exists (select 1 from connections c
        where c.id=_connection and c.status='completed'
          and (c.requester_company_id=_reviewer or c.target_company_id=_reviewer)) then
    raise exception 'Chỉ đánh giá khi kết nối đã hoàn tất' using errcode='42501';
  end if;
  insert into reviews(connection_id, reviewer_company_id, target_company_id,
      score_quality, score_progress, score_cost, score_cooperation, score_safety, score_warranty, comment)
    values (_connection, _reviewer, _target,
      _quality, _progress, _cost, _cooperation, _safety, _warranty, _comment)
    returning id into v_id;

  perform public.compute_trust_score(_target);   -- cập nhật điểm ngay
  return v_id;
end $$;

create or replace function public.request_verification(
  _company uuid, _kind text, _reference text default null, _evidence_url text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_company,'admin') then
    raise exception 'Chỉ admin/owner được gửi yêu cầu xác minh' using errcode='42501';
  end if;
  insert into company_verifications(company_id, kind, reference, evidence_url)
    values (_company, _kind, _reference, _evidence_url) returning id into v_id;
  return v_id;
end $$;

create or replace function public.mark_read(_conversation uuid, _as_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company) then
    raise exception 'Không có quyền' using errcode='42501';
  end if;
  update messages
     set read_by = (select array(select distinct e from unnest(read_by || auth.uid()) e))
   where conversation_id=_conversation and not (auth.uid() = any(read_by));
end $$;
