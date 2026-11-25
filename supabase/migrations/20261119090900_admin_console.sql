-- =============================================================
-- 20261119090900_admin_console.sql
-- Nền tảng cho trang quản trị /admin:
--   1. platform_admins + is_platform_admin()  (vai trò admin NỀN TẢNG, tách khỏi admin công ty)
--   2. Policy SELECT cho admin trên các bảng cần kiểm duyệt
--   3. RPC thao tác (security definer, kiểm tra quyền, ghi audit_log)
--   4. RPC thống kê & danh sách người dùng
--
-- Cấp quyền admin đầu tiên (chạy bằng service_role / SQL editor):
--   insert into platform_admins(user_id, note)
--   select id, 'owner' from auth.users where email = 'ban@example.com';
-- =============================================================

-- ---------- 1. Vai trò admin nền tảng ----------
create table if not exists public.platform_admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- Không tạo policy: client không đọc/ghi được. Chỉ service_role + hàm security definer.
revoke all on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant  execute on function public.is_platform_admin() to authenticated, service_role;

-- Ghi audit (nội bộ)
create or replace function public._admin_audit(
  _action text, _entity_type text, _entity_id uuid, _company uuid default null, _diff jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
  values (auth.uid(), _company, _action, _entity_type, _entity_id, _diff);
$$;
revoke execute on function public._admin_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public._require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Chỉ quản trị viên nền tảng' using errcode = '42501';
  end if;
end $$;
revoke execute on function public._require_admin() from public, anon, authenticated;

-- ---------- 2. Policy đọc cho admin ----------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','posts','marketplace_listings','reviews','quotes','reports','audit_log',
    'company_verifications','company_claims','partner_registrations','subscriptions',
    'company_members','connections'
  ] loop
    execute format('drop policy if exists admin_read_%1$s on public.%1$I', t);
    execute format('create policy admin_read_%1$s on public.%1$I for select using (public.is_platform_admin())', t);
  end loop;
end $$;

-- Xem tài liệu xác minh (bucket riêng tư) qua signed URL
drop policy if exists "admin read verification docs" on storage.objects;
create policy "admin read verification docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_platform_admin());

-- ---------- 3. RPC thao tác ----------

-- 3.1 Duyệt / từ chối xác minh (trigger t_verified_tier tự nâng tier + tính lại Trust Score)
create or replace function public.admin_review_verification(
  _id uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v company_verifications%rowtype;
begin
  perform _require_admin();
  select * into v from company_verifications where id = _id for update;
  if not found then raise exception 'Không tìm thấy yêu cầu xác minh' using errcode = 'P0002'; end if;
  if v.status <> 'pending' then raise exception 'Yêu cầu đã được xử lý' using errcode = '22023'; end if;

  update company_verifications
     set status = case when _approve then 'verified' else 'rejected' end,
         verified_by = auth.uid(), verified_at = now(),
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('admin_note', _note)
   where id = _id;

  perform _admin_audit(case when _approve then 'verification.approved' else 'verification.rejected' end,
                       'company_verification', _id, v.company_id,
                       jsonb_build_object('kind', v.kind, 'note', _note));
end $$;

-- 3.2 Duyệt / từ chối claim hồ sơ
create or replace function public.admin_review_claim(_claim uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  perform public.approve_company_claim(_claim, _approve, auth.uid());
end $$;

-- 3.3 Trạng thái & hạng xác minh của công ty
create or replace function public.admin_set_company_status(_company uuid, _status text, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if _status not in ('draft', 'published', 'suspended') then
    raise exception 'Trạng thái không hợp lệ' using errcode = '22023';
  end if;
  update companies set status = _status where id = _company;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;
  perform _admin_audit('company.status_' || _status, 'company', _company, _company,
                       jsonb_build_object('reason', _reason));
end $$;

create or replace function public.admin_set_company_tier(_company uuid, _tier text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if _tier not in ('none', 'legal', 'capability', 'gold') then
    raise exception 'Hạng không hợp lệ' using errcode = '22023';
  end if;
  update companies set verified_tier = _tier where id = _company;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;
  perform public.compute_trust_score(_company);
  perform _admin_audit('company.tier_' || _tier, 'company', _company, _company, '{}');
end $$;

-- 3.4 Ẩn / khôi phục nội dung
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
  else
    raise exception 'Loại nội dung không hỗ trợ' using errcode = '22023';
  end if;
  if v_company is null then raise exception 'Không tìm thấy nội dung' using errcode = 'P0002'; end if;
  perform _admin_audit(case when _hide then 'moderation.hide' else 'moderation.restore' end,
                       _entity, _id, v_company, jsonb_build_object('reason', _reason));
end $$;

-- 3.5 Xử lý báo cáo vi phạm
create or replace function public.admin_resolve_report(_id uuid, _status text, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if _status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Trạng thái không hợp lệ' using errcode = '22023';
  end if;
  update reports set status = _status where id = _id;
  if not found then raise exception 'Không tìm thấy báo cáo' using errcode = 'P0002'; end if;
  perform _admin_audit('report.' || _status, 'report', _id, null, jsonb_build_object('note', _note));
end $$;

-- 3.6 Cấp gói thủ công (chuyển khoản)
create or replace function public.admin_grant_plan(_company uuid, _plan text, _months int default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform _require_admin();
  if _months < 1 or _months > 36 then
    raise exception 'Số tháng phải từ 1 đến 36' using errcode = '22023';
  end if;
  if not exists (select 1 from plans where id = _plan) then
    raise exception 'Gói không tồn tại' using errcode = 'P0002';
  end if;
  update subscriptions set status = 'cancelled'
   where company_id = _company and status = 'active';
  insert into subscriptions(company_id, plan_id, status, started_at, expires_at)
    values (_company, _plan, 'active', now(), now() + make_interval(months => _months))
    returning id into v_id;
  perform _admin_audit('subscription.granted', 'subscription', v_id, _company,
                       jsonb_build_object('plan', _plan, 'months', _months));
  return v_id;
end $$;

create or replace function public.admin_cancel_subscription(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  perform _require_admin();
  update subscriptions set status = 'cancelled' where id = _id returning company_id into v_company;
  if v_company is null then raise exception 'Không tìm thấy thuê bao' using errcode = 'P0002'; end if;
  perform _admin_audit('subscription.cancelled', 'subscription', _id, v_company, '{}');
end $$;

-- 3.7 Duyệt đăng ký đối tác (staging → companies)
create or replace function public.admin_review_registration(_reg uuid, _action text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  perform _require_admin();
  if _action = 'approve' then
    v_company := public.promote_registration(_reg);
    update partner_registrations
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), company_id = v_company
     where id = _reg;
  elsif _action in ('reject', 'duplicate') then
    update partner_registrations
       set status = case when _action = 'reject' then 'rejected' else 'duplicate' end,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = _reg;
  else
    raise exception 'Hành động không hợp lệ' using errcode = '22023';
  end if;
  perform _admin_audit('registration.' || _action, 'partner_registration', _reg, v_company, '{}');
  return v_company;
end $$;

-- ---------- 4. Thống kê & người dùng ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform _require_admin();
  select jsonb_build_object(
    'companies_total',      (select count(*) from companies where deleted_at is null),
    'companies_published',  (select count(*) from companies where deleted_at is null and status = 'published'),
    'companies_suspended',  (select count(*) from companies where deleted_at is null and status = 'suspended'),
    'companies_unclaimed',  (select count(*) from companies where deleted_at is null and owner_id is null),
    'companies_verified',   (select count(*) from companies where deleted_at is null and verified_tier <> 'none'),
    'users_total',          (select count(*) from profiles),
    'users_7d',             (select count(*) from profiles where created_at > now() - interval '7 days'),
    'listings_open',        (select count(*) from marketplace_listings where status = 'open' and deleted_at is null),
    'quotes_total',         (select count(*) from quotes),
    'posts_total',          (select count(*) from posts where deleted_at is null),
    'connections_completed',(select count(*) from connections where status = 'completed'),
    'reviews_total',        (select count(*) from reviews),
    'subs_active',          (select count(*) from subscriptions where status = 'active' and (expires_at is null or expires_at > now())),
    'verifications_pending',(select count(*) from company_verifications where status = 'pending'),
    'claims_pending',       (select count(*) from company_claims where status = 'pending'),
    'reports_open',         (select count(*) from reports where status in ('open', 'reviewing')),
    'registrations_pending',(select count(*) from partner_registrations where status = 'pending'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', to_char(d, 'YYYY-MM-DD'),
               'users',     (select count(*) from profiles p where p.created_at::date = d),
               'companies', (select count(*) from companies c where c.created_at::date = d and c.deleted_at is null),
               'listings',  (select count(*) from marketplace_listings l where l.created_at::date = d and l.deleted_at is null)
             ) order by d), '[]'::jsonb)
        from generate_series(current_date - 13, current_date, interval '1 day') g(d)
    )
  ) into r;
  return r;
end $$;

create or replace function public.admin_list_users(
  _q text default null, _limit int default 20, _offset int default 0)
returns table (
  id uuid, email text, full_name text, phone text, created_at timestamptz,
  last_sign_in_at timestamptz, banned boolean, companies int, is_admin boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_admin();
  return query
  select p.id, u.email::text, p.full_name, coalesce(p.phone, u.phone::text), p.created_at,
         u.last_sign_in_at,
         (u.banned_until is not null and u.banned_until > now()),
         (select count(*)::int from company_members cm where cm.user_id = p.id and cm.status = 'active'),
         exists (select 1 from platform_admins a where a.user_id = p.id),
         count(*) over ()
    from profiles p
    left join auth.users u on u.id = p.id
   where _q is null or _q = ''
      or p.full_name ilike '%' || _q || '%'
      or u.email ilike '%' || _q || '%'
      or coalesce(p.phone, u.phone::text) ilike '%' || _q || '%'
   order by p.created_at desc
   limit least(_limit, 100) offset greatest(_offset, 0);
end $$;

-- ---------- Quyền thực thi ----------
do $$
declare f text;
begin
  foreach f in array array[
    'admin_review_verification(uuid, boolean, text)',
    'admin_review_claim(uuid, boolean)',
    'admin_set_company_status(uuid, text, text)',
    'admin_set_company_tier(uuid, text)',
    'admin_moderate(text, uuid, boolean, text)',
    'admin_resolve_report(uuid, text, text)',
    'admin_grant_plan(uuid, text, int)',
    'admin_cancel_subscription(uuid)',
    'admin_review_registration(uuid, text)',
    'admin_stats()',
    'admin_list_users(text, int, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
