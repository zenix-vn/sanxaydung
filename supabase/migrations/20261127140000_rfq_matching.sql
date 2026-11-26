-- =============================================================
-- RFQ có cấu trúc + gợi ý / mời đối tác cho chủ tin
--   1. marketplace_listings.boq : bảng khối lượng [{name, unit, qty, note}]
--      quotes.items             : đơn giá theo từng dòng BOQ [{i, unit_price}]
--   2. quotes_guard : bên báo giá KHÔNG tự đặt shortlisted/accepted/rejected,
--      không đổi listing_id/company_id (trước đây quotes_write cho phép).
--   3. suggest_partners(_listing) : gợi ý doanh nghiệp phù hợp (editor+ của chủ tin)
--   4. invite_partners(_listing, _companies[]) : chủ tin mời báo giá (giới hạn)
-- =============================================================

-- ---------- 1. Cột BOQ ----------
alter table public.marketplace_listings
  add column if not exists boq jsonb not null default '[]';
alter table public.quotes
  add column if not exists items jsonb not null default '[]';

do $$ begin
  alter table public.marketplace_listings
    add constraint listings_boq_array check (jsonb_typeof(boq) = 'array' and jsonb_array_length(boq) <= 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.quotes
    add constraint quotes_items_array check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 100);
exception when duplicate_object then null; end $$;

-- ---------- 2. Chặn bên báo giá tự duyệt ----------
create or replace function public.quotes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if new.listing_id <> old.listing_id or new.company_id <> old.company_id then
    raise exception 'Không được đổi tin hoặc doanh nghiệp của báo giá' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and new.status in ('shortlisted', 'accepted', 'rejected') then
    select company_id into v_owner from marketplace_listings where id = new.listing_id;
    if not is_company_member(v_owner, 'editor') and not public.has_platform_role('admin') then
      raise exception 'Chỉ chủ tin mới duyệt được báo giá' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_quotes_guard on public.quotes;
create trigger t_quotes_guard before update on public.quotes
  for each row execute function public.quotes_guard();

-- ---------- 3. Gợi ý đối tác ----------
create or replace function public.suggest_partners(_listing uuid, _limit int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m marketplace_listings%rowtype; v_group text;
begin
  select * into m from marketplace_listings where id = _listing and deleted_at is null;
  if not found or not is_company_member(m.company_id, 'editor') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  select group_key into v_group from categories where id = m.category_id;
  return (
    with s as (
      select c.id, c.name, c.slug, c.logo_url, c.verified_tier, coalesce(c.trust_score, 0) as trust_score,
             case when exists (select 1 from company_categories cc where cc.company_id = c.id and cc.category_id = m.category_id) then 2
                  when exists (select 1 from company_categories cc join categories k on k.id = cc.category_id
                                where cc.company_id = c.id and k.group_key = v_group) then 1
                  else 0 end as cat,
             coalesce(c.province_code = m.province_code
               or exists (select 1 from company_locations x where x.company_id = c.id and x.province_code = m.province_code), false) as near
        from companies c
       where c.status = 'published' and c.deleted_at is null and c.id <> m.company_id
    ),
    top as (
      select s.*, s.cat * 2 + case when s.near then 2 else 0 end
                  + case when s.verified_tier <> 'none' then 1 else 0 end as score
        from s
       where s.cat > 0 or (m.category_id is null and s.near)
       order by score desc, s.trust_score desc, s.name
       limit least(greatest(coalesce(_limit, 12), 1), 30)
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'slug', t.slug, 'logo_url', t.logo_url, 'verified_tier', t.verified_tier,
        'trust_score', t.trust_score, 'same_category', t.cat = 2, 'near', t.near,
        'invited', exists (select 1 from notifications n where n.company_id = t.id and n.type = 'quote_invite'
                             and n.data ->> 'listing_id' = m.id::text),
        'quoted', exists (select 1 from quotes q where q.listing_id = m.id and q.company_id = t.id),
        -- hồ sơ chưa có chủ (chưa claim) thì không ai nhận được lời mời
        'reachable', exists (select 1 from company_members cm where cm.company_id = t.id and cm.status = 'active' and cm.role in ('owner', 'admin'))
                     or exists (select 1 from companies c2 where c2.id = t.id and c2.owner_id is not null))
        order by t.score desc, t.trust_score desc, t.name), '[]')
      from top t);
end $$;
revoke execute on function public.suggest_partners(uuid, int) from public, anon;
grant  execute on function public.suggest_partners(uuid, int) to authenticated;

-- ---------- 4. Chủ tin mời báo giá ----------
create or replace function public.invite_partners(_listing uuid, _companies uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare m marketplace_listings%rowtype; v_c uuid; v_sent int := 0; v_total int; v_from text;
begin
  select * into m from marketplace_listings where id = _listing and deleted_at is null for update;
  if not found or not is_company_member(m.company_id, 'editor') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  if m.status <> 'open' then raise exception 'Tin đã đóng' using errcode = '22023'; end if;
  if coalesce(array_length(_companies, 1), 0) not between 1 and 10 then
    raise exception 'Chọn từ 1 đến 10 doanh nghiệp mỗi lần' using errcode = '22023';
  end if;
  select count(distinct company_id) into v_total from notifications
   where type = 'quote_invite' and data ->> 'listing_id' = m.id::text;
  select name into v_from from companies where id = m.company_id;

  for v_c in select distinct unnest(_companies) loop
    exit when v_total + v_sent >= 30;   -- tối đa 30 doanh nghiệp được mời / tin
    continue when v_c = m.company_id
      or not exists (select 1 from companies where id = v_c and status = 'published' and deleted_at is null)
      or exists (select 1 from notifications where company_id = v_c and type = 'quote_invite' and data ->> 'listing_id' = m.id::text)
      or exists (select 1 from quotes where listing_id = m.id and company_id = v_c);
    perform notify_company(v_c, 'quote_invite', 'Mời bạn báo giá',
      format('%s mời bạn báo giá: %s', v_from, m.title), '/marketplace/' || m.id,
      jsonb_build_object('listing_id', m.id, 'from_company', m.company_id));
    if exists (select 1 from notifications where company_id = v_c and type = 'quote_invite' and data ->> 'listing_id' = m.id::text) then
      v_sent := v_sent + 1;
    end if;
  end loop;
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
    values (auth.uid(), m.company_id, 'listing.invite_partners', 'marketplace_listing', m.id, jsonb_build_object('sent', v_sent));
  return v_sent;
end $$;
revoke execute on function public.invite_partners(uuid, uuid[]) from public, anon;
grant  execute on function public.invite_partners(uuid, uuid[]) to authenticated;
