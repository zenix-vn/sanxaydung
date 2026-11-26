-- =============================================================
-- 20261128100000_company_showcase.sql
-- Tùy biến trang hồ sơ doanh nghiệp (đợt 2):
--   - Khách hàng & đối tác tiêu biểu; giải thưởng & chứng nhận do doanh nghiệp tự công bố
--     (tách khỏi company_verifications — sàn không xác minh các mục này)
--   - Dự án: ghim nổi bật, phân loại công trình
--   - profile_settings chứa thêm tầm nhìn/sứ mệnh/giá trị và thứ tự các mục
--   - admin_merge_companies chuyển cả hai bảng mới khi gộp hồ sơ trùng
-- =============================================================

alter table public.companies drop constraint if exists companies_profile_settings_check;
alter table public.companies add constraint companies_profile_settings_check
  check (jsonb_typeof(profile_settings) = 'object' and octet_length(profile_settings::text) <= 16000);

alter table public.projects
  add column if not exists is_featured boolean not null default false,
  add column if not exists kind text;
alter table public.projects drop constraint if exists projects_kind_check;
alter table public.projects add constraint projects_kind_check
  check (kind is null or kind in ('residential','industrial','commercial','public','infrastructure','interior','other'));

create table if not exists public.company_partners (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  kind              text not null default 'client' check (kind in ('client','partner')),
  name              text not null check (char_length(name) between 1 and 120),
  logo_url          text check (char_length(logo_url) <= 500),
  website           text check (char_length(website) <= 300),
  linked_company_id uuid references public.companies(id) on delete set null,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists company_partners_company_idx on public.company_partners (company_id, sort_order);
create index if not exists company_partners_linked_idx on public.company_partners (linked_company_id);

create table if not exists public.company_awards (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  kind        text not null default 'certificate' check (kind in ('certificate','award')),
  title       text not null check (char_length(title) between 1 and 160),
  issuer      text check (char_length(issuer) <= 160),
  year        int check (year between 1900 and 2100),
  image_url   text check (char_length(image_url) <= 500),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists company_awards_company_idx on public.company_awards (company_id, sort_order);

do $$
declare t text;
begin
  foreach t in array array['company_partners','company_awards'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format($p$create policy %I on public.%I for select using (
      public.is_company_member(company_id)
      or exists (select 1 from public.companies c where c.id = company_id and c.status = 'published' and c.deleted_at is null))$p$,
      t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format($p$create policy %I on public.%I for all
      using (public.is_company_member(company_id, 'editor')) with check (public.is_company_member(company_id, 'editor'))$p$,
      t || '_write', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ---------- Gộp hồ sơ trùng: bản 20261126150000 + company_partners, company_awards ----------
create or replace function public.admin_merge_companies(_source uuid, _target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s companies%rowtype;
  t companies%rowtype;
  tbl text;
  n int;
  v_moved jsonb := '{}';
  v_tiers text[] := array['none', 'legal', 'capability', 'gold'];
begin
  perform _require_role('admin');
  if _source = _target then raise exception 'Hai hồ sơ phải khác nhau' using errcode = '22023'; end if;
  -- khóa theo thứ tự id để tránh deadlock
  perform 1 from companies where id in (_source, _target) order by id for update;
  select * into s from companies where id = _source and deleted_at is null;
  if not found then raise exception 'Không tìm thấy hồ sơ nguồn' using errcode = 'P0002'; end if;
  select * into t from companies where id = _target and deleted_at is null;
  if not found then raise exception 'Không tìm thấy hồ sơ đích' using errcode = 'P0002'; end if;
  if s.owner_id is not null and t.owner_id is not null and s.owner_id <> t.owner_id then
    raise exception 'Hai hồ sơ đang thuộc hai chủ khác nhau — gỡ chủ sở hữu của một bên trước' using errcode = '22023';
  end if;

  -- bảng chuyển thẳng
  foreach tbl in array array['company_invitations','company_verifications','projects','media','documents','services',
                             'equipment','staff','posts','marketplace_listings','notifications','ad_placements','payments',
                             'company_partners','company_awards'] loop
    execute format('update public.%I set company_id = $1 where company_id = $2', tbl) using t.id, s.id;
    get diagnostics n = row_count;
    if n > 0 then v_moved := v_moved || jsonb_build_object(tbl, n); end if;
  end loop;

  -- hồ sơ khác đang liên kết tới hồ sơ nguồn thì trỏ sang hồ sơ đích
  update company_partners set linked_company_id = t.id where linked_company_id = s.id;

  -- thành viên: người có ở cả hai giữ vai trò cao hơn
  update company_members tm set role = sm.role, status = 'active'
    from company_members sm
   where tm.company_id = t.id and sm.company_id = s.id and sm.user_id = tm.user_id and sm.status = 'active'
     and (tm.status <> 'active'
          or array_position(array['member','editor','admin','owner'], sm.role)
             > array_position(array['member','editor','admin','owner'], tm.role));
  update company_members m set company_id = t.id
   where m.company_id = s.id
     and not exists (select 1 from company_members x where x.company_id = t.id and x.user_id = m.user_id);
  delete from company_members where company_id = s.id;

  insert into company_categories(company_id, category_id)
    select t.id, category_id from company_categories where company_id = s.id on conflict do nothing;
  insert into company_locations(company_id, province_code)
    select t.id, province_code from company_locations where company_id = s.id on conflict do nothing;
  delete from company_categories where company_id = s.id;
  delete from company_locations where company_id = s.id;

  -- bảng có ràng buộc duy nhất: bản trùng ở lại hồ sơ nguồn
  update quotes q set company_id = t.id where q.company_id = s.id
     and not exists (select 1 from quotes x where x.company_id = t.id and x.listing_id = q.listing_id);
  update conversation_participants p set company_id = t.id where p.company_id = s.id
     and not exists (select 1 from conversation_participants x where x.company_id = t.id and x.conversation_id = p.conversation_id);
  update messages set sender_company_id = t.id where sender_company_id = s.id;
  update connections set requester_company_id = t.id where requester_company_id = s.id and target_company_id <> t.id;
  update connections set target_company_id = t.id where target_company_id = s.id and requester_company_id <> t.id;
  update reviews r set target_company_id = t.id where r.target_company_id = s.id and r.reviewer_company_id <> t.id;
  update reviews r set reviewer_company_id = t.id where r.reviewer_company_id = s.id and r.target_company_id <> t.id
     and not exists (select 1 from reviews x where x.reviewer_company_id = t.id and x.connection_id = r.connection_id);

  -- chỉ giữ 1 gói đang chạy
  if exists (select 1 from subscriptions where company_id = t.id and status = 'active') then
    update subscriptions set status = 'cancelled' where company_id = s.id and status = 'active';
  end if;
  update subscriptions set company_id = t.id where company_id = s.id;

  update company_claims c set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
   where c.company_id = s.id and c.status = 'pending'
     and exists (select 1 from company_claims x where x.company_id = t.id and x.user_id = c.user_id and x.status = 'pending');
  update company_claims set company_id = t.id where company_id = s.id;

  -- đánh dấu 'duplicate' để sync_all_registrations không ghi đè hồ sơ đích bằng dữ liệu bản trùng
  update partner_registrations set company_id = t.id, status = 'duplicate' where company_id = s.id;

  update companies set deleted_at = now(), status = 'draft', owner_id = null, verified_tier = 'none' where id = s.id;
  delete from trust_scores where company_id = s.id;

  -- lấp chỗ trống của hồ sơ đích bằng dữ liệu nguồn
  update companies set
    legal_name = coalesce(legal_name, s.legal_name), tax_code = coalesce(nullif(trim(tax_code), ''), s.tax_code),
    phone = coalesce(nullif(trim(phone), ''), s.phone), email = coalesce(email, s.email),
    website = coalesce(website, s.website), address = coalesce(address, s.address),
    province_code = coalesce(province_code, s.province_code), founded_year = coalesce(founded_year, s.founded_year),
    size_range = coalesce(size_range, s.size_range), intro = coalesce(intro, s.intro),
    description = coalesce(description, s.description), logo_url = coalesce(logo_url, s.logo_url),
    cover_url = coalesce(cover_url, s.cover_url), owner_id = coalesce(owner_id, s.owner_id),
    verified_tier = v_tiers[greatest(array_position(v_tiers, verified_tier), array_position(v_tiers, s.verified_tier))]
   where id = t.id returning * into t;

  -- chỉ một vai trò 'owner', khớp companies.owner_id
  if t.owner_id is not null then
    update company_members set role = 'admin' where company_id = t.id and role = 'owner' and user_id <> t.owner_id;
    insert into company_members(company_id, user_id, role, status) values (t.id, t.owner_id, 'owner', 'active')
      on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
  end if;

  perform compute_trust_score(t.id);
  perform _admin_audit('company.merged', 'company', t.id, t.id,
    jsonb_build_object('source_id', s.id, 'source_name', s.name, 'source_slug', s.slug,
                       'source_phone', s.phone, 'moved', v_moved));
end $$;
