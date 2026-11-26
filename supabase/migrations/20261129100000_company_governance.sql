-- =============================================================
-- 20261129100000_company_governance.sql
-- Tùy biến trang hồ sơ doanh nghiệp (đợt 3 — quản trị):
--   1. Phân quyền: biên tập viên sửa nội dung; chỉ chủ sở hữu/quản trị đổi tên, đường dẫn,
--      thông tin pháp lý, trạng thái xuất bản, màu thương hiệu.
--   2. Lịch sử chỉnh sửa company_revisions (ghi tự động bằng trigger).
--   3. Kiểm duyệt ảnh/video thư viện: kiểm duyệt viên của sàn ẩn được.
-- =============================================================

-- ---------- 1. Phân quyền (thay companies_guard của 20261126100000) ----------
-- KHÔNG security definer: cần current_user là role đang thực thi câu lệnh
create or replace function public.companies_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_tier := 'none';
    new.trust_score   := 0;
    new.deleted_at    := null;
    if new.status = 'suspended' then new.status := 'draft'; end if;
    return new;
  end if;

  if new.verified_tier is distinct from old.verified_tier
     or new.trust_score is distinct from old.trust_score
     or new.owner_id    is distinct from old.owner_id
     or new.deleted_at  is distinct from old.deleted_at
     or (new.status is distinct from old.status and 'suspended' in (new.status, old.status)) then
    raise exception 'Trường này do hệ thống quản lý, không thể tự thay đổi' using errcode = '42501';
  end if;

  if (new.name       is distinct from old.name
      or new.slug       is distinct from old.slug
      or new.legal_name is distinct from old.legal_name
      or new.tax_code   is distinct from old.tax_code
      or new.status     is distinct from old.status
      or (new.profile_settings -> 'brand_color') is distinct from (old.profile_settings -> 'brand_color'))
     and not public.is_company_member(old.id, 'admin') then
    raise exception 'Chỉ chủ sở hữu hoặc quản trị viên được đổi tên, đường dẫn, thông tin pháp lý, trạng thái và màu thương hiệu'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------- 2. Lịch sử chỉnh sửa ----------
create table if not exists public.company_revisions (
  id         bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  entity     text not null,
  entity_id  uuid not null,
  action     text not null check (action in ('insert','update','delete')),
  label      text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists company_revisions_company_idx on public.company_revisions (company_id, id desc);

alter table public.company_revisions enable row level security;
drop policy if exists company_revisions_read on public.company_revisions;
create policy company_revisions_read on public.company_revisions for select
  using (public.is_company_member(company_id, 'editor') or public.is_platform_admin());
-- chỉ trigger (security definer) được ghi
revoke insert, update, delete on public.company_revisions from anon, authenticated;
grant select on public.company_revisions to anon, authenticated;
grant all on public.company_revisions to service_role;

create or replace function public.log_company_revision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- cột hệ thống / không đáng ghi
  v_skip text[] := array['id','company_id','created_at','updated_at','sort_order','search_tsv',
                         'trust_score','profile_completeness','verified_tier','owner_id','deleted_at'];
  o jsonb; n jsonb; r jsonb;
  b jsonb := '{}'; a jsonb := '{}';
  k text; v_company uuid; v_keep bigint;
begin
  if auth.uid() is null then return null; end if;          -- đồng bộ hệ thống, cron
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  r := coalesce(n, o);
  v_company := (case when tg_table_name = 'companies' then r ->> 'id' else r ->> 'company_id' end)::uuid;
  -- đang xóa cả công ty (cascade) thì không ghi
  if not exists (select 1 from companies where id = v_company) then return null; end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k <> all (v_skip) and (n -> k) is distinct from (o -> k) then
        b := b || jsonb_build_object(k, o -> k);
        a := a || jsonb_build_object(k, n -> k);
      end if;
    end loop;
    if a = '{}'::jsonb then return null; end if;
  elsif tg_op = 'INSERT' then
    a := n - v_skip;
  else
    b := o - v_skip;
  end if;

  insert into company_revisions(company_id, actor_id, entity, entity_id, action, label, before, after)
  values (v_company, (select id from profiles where id = auth.uid()), tg_table_name, (r ->> 'id')::uuid, lower(tg_op),
          left(coalesce(r ->> 'title', r ->> 'name', r ->> 'full_name', r ->> 'question', r ->> 'caption'), 160),
          nullif(b, '{}'::jsonb), nullif(a, '{}'::jsonb));

  -- giữ 300 bản gần nhất mỗi công ty
  select id into v_keep from company_revisions where company_id = v_company order by id desc offset 299 limit 1;
  if v_keep is not null then
    delete from company_revisions where company_id = v_company and id < v_keep;
  end if;
  return null;
end $$;
revoke execute on function public.log_company_revision() from public, anon, authenticated;

drop trigger if exists t_companies_revision on public.companies;
create trigger t_companies_revision after update on public.companies
  for each row execute function public.log_company_revision();

do $$
declare t text;
begin
  foreach t in array array['projects','services','staff','equipment','documents','media',
                           'company_partners','company_awards','company_branches','company_milestones','company_faqs'] loop
    execute format('drop trigger if exists %I on public.%I', 't_' || t || '_revision', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function public.log_company_revision()', 't_' || t || '_revision', t);
  end loop;
end $$;

-- ---------- 3. Kiểm duyệt ảnh/video ----------
alter table public.media add column if not exists hidden_at timestamptz;

create or replace function public.media_guard()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- doanh nghiệp không tự gỡ được trạng thái bị ẩn
    new.hidden_at := case when tg_op = 'UPDATE' then old.hidden_at end;
  end if;
  return new;
end $$;
drop trigger if exists t_media_guard on public.media;
create trigger t_media_guard before insert or update on public.media
  for each row execute function public.media_guard();

drop policy if exists media_read on public.media;
create policy media_read on public.media for select using (
  public.is_company_member(company_id)
  or (hidden_at is null and exists (select 1 from public.companies c where c.id = company_id and c.status = 'published'))
);
drop policy if exists admin_read_media on public.media;
create policy admin_read_media on public.media for select using (public.is_platform_admin());

-- admin_moderate: thêm loại 'media'
create or replace function public.admin_moderate(_entity text, _id uuid, _hide boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  perform _require_admin();
  if _entity = 'post' then
    update posts set status = case when _hide then 'hidden' else 'published' end
     where id = _id returning company_id into v_company;
  elsif _entity = 'listing' then
    update marketplace_listings set status = case when _hide then 'closed' else 'open' end
     where id = _id returning company_id into v_company;
  elsif _entity = 'review' then
    update reviews set status = case when _hide then 'hidden' else 'published' end
     where id = _id returning target_company_id into v_company;
    if found then perform public.compute_trust_score(v_company); end if;
  elsif _entity = 'media' then
    update media set hidden_at = case when _hide then now() end
     where id = _id returning company_id into v_company;
  else
    raise exception 'Loại nội dung không hỗ trợ' using errcode = '22023';
  end if;
  if v_company is null then raise exception 'Không tìm thấy nội dung' using errcode = 'P0002'; end if;
  perform _admin_audit(case when _hide then 'moderation.hide' else 'moderation.restore' end,
                       _entity, _id, v_company, jsonb_build_object('reason', _reason));
end $$;
