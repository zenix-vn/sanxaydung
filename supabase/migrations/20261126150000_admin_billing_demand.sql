-- =============================================================
-- 20261126150000_admin_billing_demand.sql
-- Gói & thanh toán: sửa bảng giá, ghi nhận tiền thủ công (kèm số hóa đơn), nhắc gia hạn.
-- Nhu cầu & báo giá: theo dõi tin chưa ai báo giá, gợi ý đối tác và mời báo giá.
-- =============================================================

-- ---------- Bảng giá: lấy nội dung ĐANG CÔNG KHAI trên /pricing làm chuẩn ----------
-- (trước đây DB ghi Professional 499.000₫ và 30 tin, trang web ghi 990.000₫ và không giới hạn)
update public.plans set features = features || jsonb_build_object(
    'desc', 'Tạo hiện diện số & bắt đầu kết nối cơ bản.', 'members', 3, 'contact', false,
    'bullets', jsonb_build_array('Company Page cơ bản', 'Xác minh pháp lý (MST/GPKD)', 'Đăng 3 tin nhu cầu/tháng', 'Chat & nhận báo giá', 'Nhận đánh giá xác thực'),
    'excluded', jsonb_build_array('Hồ sơ nổi bật', 'Analytics nâng cao'))
 where id = 'free';
update public.plans set price_month = 990000, features = features || jsonb_build_object(
    'desc', 'Cho doanh nghiệp muốn tăng cơ hội & nổi bật.', 'members', 10, 'listings', -1, 'contact', false,
    'bullets', jsonb_build_array('Toàn bộ gói Free', 'Hồ sơ & tin đăng nổi bật', 'Đăng tin không giới hạn', 'Analytics: lượt xem, nguồn khách', 'Video giới thiệu & album mở rộng', 'Huy hiệu ưu tiên tìm kiếm', '10 thành viên'),
    'excluded', jsonb_build_array())
 where id = 'professional';
update public.plans set features = features || jsonb_build_object(
    'desc', 'Cho tổng thầu & tập đoàn cần quy mô & tích hợp.', 'members', -1, 'contact', true,
    'bullets', jsonb_build_array('Toàn bộ gói Professional', 'Analytics & benchmark ngành', 'Báo cáo thị trường độc quyền', 'Thành viên & phân quyền không giới hạn', 'Hỗ trợ ưu tiên + account manager', 'API tích hợp (GĐ3)'),
    'excluded', jsonb_build_array())
 where id = 'enterprise';

create or replace function public.admin_update_plan(_id text, _name text, _price numeric, _features jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare p plans%rowtype; k text;
begin
  perform _require_role('owner');
  select * into p from plans where id = _id for update;
  if not found then raise exception 'Gói không tồn tại' using errcode = 'P0002'; end if;
  if nullif(trim(coalesce(_name, '')), '') is null then raise exception 'Thiếu tên gói' using errcode = '22023'; end if;
  if _price is null or _price < 0 or _price > 1000000000 or _price <> trunc(_price) then
    raise exception 'Giá không hợp lệ' using errcode = '22023';
  end if;
  if jsonb_typeof(_features) is distinct from 'object' then raise exception 'Quyền lợi không hợp lệ' using errcode = '22023'; end if;
  foreach k in array array['bullets', 'excluded'] loop
    if _features ? k and (jsonb_typeof(_features -> k) <> 'array'
        or exists (select 1 from jsonb_array_elements(_features -> k) e where jsonb_typeof(e) <> 'string')) then
      raise exception 'Danh sách quyền lợi không hợp lệ' using errcode = '22023';
    end if;
  end loop;
  foreach k in array array['listings', 'members', 'featured'] loop
    if _features ? k and (jsonb_typeof(_features -> k) <> 'number' or (_features ->> k)::numeric < -1) then
      raise exception 'Hạn mức phải là số từ -1 (không giới hạn)' using errcode = '22023';
    end if;
  end loop;
  update plans set name = trim(_name), price_month = _price, features = coalesce(features, '{}') || _features where id = _id;
  perform _admin_audit('plan.updated', 'plan', gen_random_uuid(), null,
    jsonb_build_object('plan', _id, 'price', jsonb_build_array(p.price_month, _price), 'name', trim(_name)));
end $$;

-- ---------- Thanh toán thủ công ----------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id         text references public.plans(id),
  months          int not null default 0 check (months between 0 and 36),
  amount          numeric(14,0) not null check (amount > 0),
  method          text not null default 'bank_transfer' check (method in ('bank_transfer', 'cash', 'other')),
  invoice_no      text,
  reference       text,
  note            text,
  paid_at         date not null,
  recorded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references public.profiles(id) on delete set null,
  void_reason     text
);
create index if not exists payments_company_idx on public.payments (company_id);
create index if not exists payments_paid_idx on public.payments (paid_at desc);
-- chống ghi trùng một giao dịch / một số hóa đơn
create unique index if not exists payments_reference_uq on public.payments (lower(reference)) where reference is not null and voided_at is null;
create unique index if not exists payments_invoice_uq on public.payments (lower(invoice_no)) where invoice_no is not null and voided_at is null;
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
drop policy if exists admin_read_payments on public.payments;
create policy admin_read_payments on public.payments for select using (public.has_platform_role('admin'));

create or replace function public.admin_record_payment(
  _company uuid, _plan text, _months int, _amount numeric, _method text default 'bank_transfer',
  _invoice text default null, _reference text default null, _paid_at date default null, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub uuid; v_id uuid;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform _require_role('admin');
  perform 1 from companies where id = _company and deleted_at is null for update;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;
  if _amount is null or _amount <= 0 or _amount <> trunc(_amount) then raise exception 'Số tiền không hợp lệ' using errcode = '22023'; end if;
  if coalesce(_months, -1) not between 0 and 36 then raise exception 'Số tháng phải từ 0 đến 36' using errcode = '22023'; end if;
  if coalesce(_paid_at, v_today) > v_today then raise exception 'Ngày nhận tiền không thể ở tương lai' using errcode = '22023'; end if;
  if _plan is not null and not exists (select 1 from plans where id = _plan) then raise exception 'Gói không tồn tại' using errcode = 'P0002'; end if;
  if _months > 0 and _plan is null then raise exception 'Chọn gói cần kích hoạt' using errcode = '22023'; end if;
  if exists (select 1 from payments where voided_at is null and lower(reference) = lower(nullif(trim(_reference), ''))) then
    raise exception 'Mã giao dịch này đã được ghi nhận' using errcode = '23505';
  end if;
  if exists (select 1 from payments where voided_at is null and lower(invoice_no) = lower(nullif(trim(_invoice), ''))) then
    raise exception 'Số hóa đơn này đã được dùng' using errcode = '23505';
  end if;

  if _months > 0 then
    -- gia hạn gói đang chạy cùng loại: cộng nối tiếp; khác loại: thay thế
    update subscriptions set expires_at = expires_at + make_interval(months => _months)
     where id = (select id from subscriptions where company_id = _company and plan_id = _plan and status = 'active'
                   and expires_at > now() order by expires_at desc limit 1)
     returning id into v_sub;
    if v_sub is null then
      update subscriptions set status = 'cancelled' where company_id = _company and status = 'active';
      insert into subscriptions(company_id, plan_id, status, started_at, expires_at)
        values (_company, _plan, 'active', now(), now() + make_interval(months => _months)) returning id into v_sub;
    end if;
  end if;

  insert into payments(company_id, subscription_id, plan_id, months, amount, method, invoice_no, reference, note, paid_at, recorded_by)
    values (_company, v_sub, _plan, _months, _amount, coalesce(_method, 'bank_transfer'), nullif(trim(_invoice), ''),
            nullif(trim(_reference), ''), nullif(trim(_note), ''), coalesce(_paid_at, v_today), auth.uid())
    returning id into v_id;
  perform _admin_audit('payment.recorded', 'payment', v_id, _company,
    jsonb_build_object('amount', _amount, 'plan', _plan, 'months', _months, 'invoice', nullif(trim(_invoice), '')));
  return v_id;
end $$;

create or replace function public.admin_void_payment(_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_amount numeric;
begin
  perform _require_role('admin');
  if nullif(trim(coalesce(_reason, '')), '') is null then raise exception 'Cần nhập lý do hủy' using errcode = '22023'; end if;
  update payments set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason)
   where id = _id and voided_at is null returning company_id, amount into v_company, v_amount;
  if not found then raise exception 'Không tìm thấy phiếu thu còn hiệu lực' using errcode = 'P0002'; end if;
  perform _admin_audit('payment.voided', 'payment', _id, v_company, jsonb_build_object('amount', v_amount, 'reason', trim(_reason)));
end $$;

create or replace function public.admin_remind_renewal(_sub uuid)
returns int language plpgsql security definer set search_path = public as $$
declare s subscriptions%rowtype; v_plan text; n int;
begin
  perform _require_role('admin');
  select * into s from subscriptions where id = _sub for update;
  if not found or s.status = 'cancelled' then raise exception 'Không tìm thấy thuê bao' using errcode = 'P0002'; end if;
  if s.expires_at is null or s.expires_at > now() + interval '30 days' then
    raise exception 'Gói còn hơn 30 ngày, chưa cần nhắc' using errcode = '22023';
  end if;
  if exists (select 1 from notifications where company_id = s.company_id and type = 'subscription_reminder'
              and data ->> 'subscription_id' = _sub::text and created_at > now() - interval '3 days') then
    raise exception 'Đã nhắc trong 3 ngày qua' using errcode = '22023';
  end if;
  select name into v_plan from plans where id = s.plan_id;
  perform notify_company(s.company_id, 'subscription_reminder',
    case when s.expires_at < now() then 'Gói dịch vụ đã hết hạn' else 'Gói dịch vụ sắp hết hạn' end,
    format('Gói %s %s ngày %s. Gia hạn để không gián đoạn quyền lợi.', coalesce(v_plan, s.plan_id),
      case when s.expires_at < now() then 'đã hết hạn' else 'sẽ hết hạn' end,
      to_char(s.expires_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY')),
    '/pricing/checkout?plan=' || s.plan_id, jsonb_build_object('subscription_id', _sub));
  select count(*) into n from notifications where type = 'subscription_reminder' and data ->> 'subscription_id' = _sub::text and created_at >= now();
  if n = 0 then raise exception 'Hồ sơ chưa có người nhận thông báo — hãy gọi điện' using errcode = '22023'; end if;
  perform _admin_audit('subscription.reminded', 'subscription', _sub, s.company_id, jsonb_build_object('recipients', n));
  return n;
end $$;

create or replace function public.admin_billing_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_month date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  perform _require_role('admin');
  return jsonb_build_object(
    'month',      (select coalesce(sum(amount), 0) from payments where voided_at is null and paid_at >= v_month),
    'last_month', (select coalesce(sum(amount), 0) from payments where voided_at is null and paid_at >= v_month - interval '1 month' and paid_at < v_month),
    'year',       (select coalesce(sum(amount), 0) from payments where voided_at is null and paid_at >= date_trunc('year', v_month)),
    'paying',     (select count(distinct s.company_id) from subscriptions s join plans p on p.id = s.plan_id
                    where s.status = 'active' and (s.expires_at is null or s.expires_at > now()) and p.price_month > 0),
    'expiring',   (select count(*) from subscriptions where status = 'active' and expires_at > now() and expires_at <= now() + interval '30 days'),
    'overdue',    (select count(*) from subscriptions where status = 'active' and expires_at <= now()));
end $$;

-- ---------- Nhu cầu & báo giá ----------
alter table public.admin_work_items drop constraint if exists admin_work_items_kind_check;
alter table public.admin_work_items add constraint admin_work_items_kind_check check (kind in ('verification', 'claim', 'registration', 'report', 'listing'));
alter table public.admin_notes drop constraint if exists admin_notes_kind_check;
alter table public.admin_notes add constraint admin_notes_kind_check check (kind in ('verification', 'claim', 'registration', 'report', 'listing'));

create or replace function public.admin_demand(_tab text default 'unanswered', _limit int default 20, _offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return (
    with l as (
      select m.*,
             (select count(*) from quotes q where q.listing_id = m.id and q.status <> 'withdrawn') as quotes_n,
             (select min(q.created_at) from quotes q where q.listing_id = m.id and q.status = 'sent') as oldest_sent
        from marketplace_listings m where m.deleted_at is null
    ),
    t as (
      select l.*,
             (status = 'open' and quotes_n = 0) as unanswered,
             (status = 'open' and oldest_sent < now() - interval '2 days') as waiting
        from l
    ),
    page as (
      select * from t
       where case _tab when 'unanswered' then unanswered when 'waiting' then waiting else true end
       order by case when _tab = 'all' then null else created_at end asc, created_at desc
       limit least(_limit, 100) offset greatest(_offset, 0)
    )
    select jsonb_build_object(
      'counts', (select jsonb_build_object('unanswered', count(*) filter (where unanswered), 'waiting', count(*) filter (where waiting), 'all', count(*)) from t),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', p.id, 'title', p.title, 'type', p.type, 'status', p.status, 'created_at', p.created_at, 'deadline', p.deadline,
          'category', (select name from categories where id = p.category_id),
          'province', coalesce((select name from provinces where code = p.province_code), p.location_text),
          'company_id', c.id, 'company', c.name, 'phone', c.phone,
          'quotes', p.quotes_n, 'oldest_sent', p.oldest_sent,
          'invited', (select count(distinct n.company_id) from notifications n where n.type = 'quote_invite' and n.data ->> 'listing_id' = p.id::text))
          order by case when _tab = 'all' then null else p.created_at end asc, p.created_at desc), '[]')
        from page p left join companies c on c.id = p.company_id)));
end $$;

-- Doanh nghiệp phù hợp với một tin: cùng lĩnh vực (2 điểm, cùng nhóm 1 điểm) và cùng tỉnh (2 điểm)
create or replace function public.admin_match_companies(_listing uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m marketplace_listings%rowtype; v_group text;
begin
  perform _require_role('admin');
  select * into m from marketplace_listings where id = _listing and deleted_at is null;
  if not found then raise exception 'Không tìm thấy tin' using errcode = 'P0002'; end if;
  select group_key into v_group from categories where id = m.category_id;
  return (
    with s as (
      select c.id, c.name, c.slug, c.phone, c.verified_tier, c.trust_score,
             case when exists (select 1 from company_categories cc where cc.company_id = c.id and cc.category_id = m.category_id) then 2
                  when exists (select 1 from company_categories cc join categories k on k.id = cc.category_id where cc.company_id = c.id and k.group_key = v_group) then 1
                  else 0 end as cat,
             (c.province_code = m.province_code or exists (select 1 from company_locations x where x.company_id = c.id and x.province_code = m.province_code)) as near
        from companies c
       where c.status = 'published' and c.deleted_at is null and c.id <> m.company_id
    ),
    top as (
      select s.*, s.cat + case when s.near then 2 else 0 end as score from s
       where s.cat > 0 or (m.category_id is null and s.near)
       order by s.cat + case when s.near then 2 else 0 end desc, s.trust_score desc, s.name
       limit 30
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'slug', t.slug, 'phone', t.phone, 'verified_tier', t.verified_tier,
        'same_category', t.cat = 2, 'near', coalesce(t.near, false),
        'reachable', exists (select 1 from companies c where c.id = t.id and c.owner_id is not null)
                     or exists (select 1 from company_members cm where cm.company_id = t.id and cm.status = 'active' and cm.role in ('owner', 'admin')),
        'invited', exists (select 1 from notifications n where n.company_id = t.id and n.type = 'quote_invite' and n.data ->> 'listing_id' = m.id::text),
        'quoted', exists (select 1 from quotes q where q.listing_id = m.id and q.company_id = t.id))
        order by t.score desc, t.trust_score desc, t.name), '[]')
      from top t);
end $$;

create or replace function public.admin_invite_quote(_listing uuid, _companies uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare m marketplace_listings%rowtype; v_c uuid; v_sent int := 0;
begin
  perform _require_role('admin');
  select * into m from marketplace_listings where id = _listing and deleted_at is null for update;
  if not found then raise exception 'Không tìm thấy tin' using errcode = 'P0002'; end if;
  if m.status <> 'open' then raise exception 'Tin đã đóng' using errcode = '22023'; end if;
  if coalesce(array_length(_companies, 1), 0) not between 1 and 20 then raise exception 'Chọn từ 1 đến 20 doanh nghiệp' using errcode = '22023'; end if;
  for v_c in select distinct unnest(_companies) loop
    continue when v_c = m.company_id
      or not exists (select 1 from companies where id = v_c and status = 'published' and deleted_at is null)
      or exists (select 1 from notifications where company_id = v_c and type = 'quote_invite' and data ->> 'listing_id' = m.id::text)
      or exists (select 1 from quotes where listing_id = m.id and company_id = v_c);
    perform notify_company(v_c, 'quote_invite', 'Mời bạn báo giá', m.title, '/marketplace/' || m.id, jsonb_build_object('listing_id', m.id));
    if exists (select 1 from notifications where company_id = v_c and type = 'quote_invite' and data ->> 'listing_id' = m.id::text) then
      v_sent := v_sent + 1;
    end if;
  end loop;
  if v_sent > 0 then
    perform _admin_audit('listing.invited', 'marketplace_listing', m.id, m.company_id, jsonb_build_object('sent', v_sent));
  end if;
  return v_sent;
end $$;

-- ---------- Gộp hồ sơ: chuyển cả phiếu thu ----------
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
                             'equipment','staff','posts','marketplace_listings','notifications','ad_placements','payments'] loop
    execute format('update public.%I set company_id = $1 where company_id = $2', tbl) using t.id, s.id;
    get diagnostics n = row_count;
    if n > 0 then v_moved := v_moved || jsonb_build_object(tbl, n); end if;
  end loop;

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

do $$
declare f text;
begin
  foreach f in array array[
    'admin_update_plan(text, text, numeric, jsonb)',
    'admin_record_payment(uuid, text, int, numeric, text, text, text, date, text)',
    'admin_void_payment(uuid, text)',
    'admin_remind_renewal(uuid)',
    'admin_billing_summary()',
    'admin_demand(text, int, int)',
    'admin_match_companies(uuid)',
    'admin_invite_quote(uuid, uuid[])'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
