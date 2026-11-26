-- =============================================================
-- 20261126090000_platform_roles.sql
-- Phân quyền nhân sự nền tảng + khóa tài khoản.
--   owner     Chủ sở hữu      : toàn quyền, là người DUY NHẤT được phân quyền
--   admin     Quản trị viên   : mọi thao tác vận hành, khóa/mở khóa thành viên
--   moderator Kiểm duyệt viên : chỉ hàng chờ (xác minh, claim, đăng ký đối tác, kiểm duyệt)
--   (không có dòng trong platform_admins = thành viên thường)
-- Quy tắc an toàn: không tự đổi quyền / tự khóa chính mình; không khóa nhân sự
-- (phải hạ về thành viên trước); luôn còn ít nhất 1 chủ sở hữu.
-- =============================================================

alter table public.platform_admins add column if not exists role text not null default 'admin';
alter table public.platform_admins drop constraint if exists platform_admins_role_check;
alter table public.platform_admins add constraint platform_admins_role_check check (role in ('owner', 'admin', 'moderator'));

update public.platform_admins set role = 'owner' where note = 'owner';
-- Bảo đảm có chủ sở hữu: nếu chưa có thì người được cấp sớm nhất thành owner
update public.platform_admins set role = 'owner'
 where not exists (select 1 from public.platform_admins where role = 'owner')
   and user_id = (select user_id from public.platform_admins order by created_at limit 1);

create or replace function public._role_rank(_role text)
returns int language sql immutable as $$
  select case _role when 'owner' then 3 when 'admin' then 2 when 'moderator' then 1 else 0 end;
$$;

create or replace function public.platform_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.platform_admins where user_id = auth.uid();
$$;
revoke execute on function public.platform_role() from public;
grant  execute on function public.platform_role() to anon, authenticated, service_role;

create or replace function public.has_platform_role(_min text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public._role_rank(public.platform_role()) >= public._role_rank(_min), false);
$$;
revoke execute on function public.has_platform_role(text) from public;
-- anon cần EXECUTE vì hàm nằm trong policy (xem hotfix 20261119093100); với anon luôn trả false
grant  execute on function public.has_platform_role(text) to anon, authenticated, service_role;

create or replace function public._require_role(_min text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_platform_role(_min) then
    raise exception 'Bạn không có quyền thực hiện thao tác này' using errcode = '42501';
  end if;
end $$;
revoke execute on function public._require_role(text) from public, anon, authenticated;

-- Dữ liệu tài chính & nhật ký: chỉ quản trị viên trở lên
drop policy if exists admin_read_subscriptions on public.subscriptions;
create policy admin_read_subscriptions on public.subscriptions for select using (public.has_platform_role('admin'));
drop policy if exists admin_read_audit_log on public.audit_log;
create policy admin_read_audit_log on public.audit_log for select using (public.has_platform_role('admin'));

-- ---------- Các RPC vận hành: nâng yêu cầu lên admin ----------
create or replace function public.admin_set_company_status(_company uuid, _status text, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_role('admin');
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
  perform _require_role('admin');
  if _tier not in ('none', 'legal', 'capability', 'gold') then
    raise exception 'Hạng không hợp lệ' using errcode = '22023';
  end if;
  update companies set verified_tier = _tier where id = _company;
  if not found then raise exception 'Không tìm thấy công ty' using errcode = 'P0002'; end if;
  perform public.compute_trust_score(_company);
  perform _admin_audit('company.tier_' || _tier, 'company', _company, _company, '{}');
end $$;

create or replace function public.admin_grant_plan(_company uuid, _plan text, _months int default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform _require_role('admin');
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
  perform _require_role('admin');
  update subscriptions set status = 'cancelled' where id = _id returning company_id into v_company;
  if v_company is null then raise exception 'Không tìm thấy thuê bao' using errcode = 'P0002'; end if;
  perform _admin_audit('subscription.cancelled', 'subscription', _id, v_company, '{}');
end $$;

-- ---------- Danh sách người dùng (thêm vai trò, trạng thái xóa, bộ lọc) ----------
drop function if exists public.admin_list_users(text, int, int);
create or replace function public.admin_list_users(
  _q text default null, _limit int default 20, _offset int default 0, _filter text default null)
returns table (
  id uuid, email text, full_name text, phone text, created_at timestamptz,
  last_sign_in_at timestamptz, banned boolean, deleted boolean, companies int,
  role text, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('admin');
  return query
  select p.id, u.email::text, p.full_name, coalesce(p.phone, u.phone::text), p.created_at,
         u.last_sign_in_at,
         (u.banned_until is not null and u.banned_until > now()),
         (u.deleted_at is not null),
         (select count(*)::int from company_members cm where cm.user_id = p.id and cm.status = 'active'),
         a.role,
         count(*) over ()
    from profiles p
    left join auth.users u on u.id = p.id
    left join platform_admins a on a.user_id = p.id
   where (_q is null or _q = ''
          or p.full_name ilike '%' || _q || '%'
          or u.email ilike '%' || _q || '%'
          or coalesce(p.phone, u.phone::text) ilike '%' || _q || '%')
     and (_filter is null or _filter = ''
          or (_filter = 'staff'  and a.role is not null)
          or (_filter = 'banned' and u.deleted_at is null and u.banned_until > now())
          or (_filter in ('owner', 'admin', 'moderator') and a.role = _filter))
   order by public._role_rank(a.role) desc, p.created_at desc
   limit least(_limit, 100) offset greatest(_offset, 0);
end $$;

-- ---------- Phân quyền (chỉ chủ sở hữu) ----------
create or replace function public.admin_set_user_role(_user uuid, _role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_deleted boolean;
begin
  perform _require_role('owner');
  if _role not in ('owner', 'admin', 'moderator', 'member') then
    raise exception 'Vai trò không hợp lệ' using errcode = '22023';
  end if;
  if _user = auth.uid() then
    raise exception 'Không thể tự đổi quyền của chính mình' using errcode = '42501';
  end if;
  select u.deleted_at is not null into v_deleted from auth.users u join profiles p on p.id = u.id where u.id = _user;
  if not found then raise exception 'Không tìm thấy người dùng' using errcode = 'P0002'; end if;
  if v_deleted then raise exception 'Tài khoản đã bị xóa' using errcode = '22023'; end if;

  select role into v_old from platform_admins where user_id = _user for update;
  if coalesce(v_old, 'member') = _role then return; end if;

  if _role = 'member' then
    delete from platform_admins where user_id = _user;
  else
    if exists (select 1 from auth.users where id = _user and banned_until > now()) then
      raise exception 'Mở khóa tài khoản trước khi cấp quyền' using errcode = '22023';
    end if;
    insert into platform_admins(user_id, role, note) values (_user, _role, null)
      on conflict (user_id) do update set role = excluded.role;
  end if;
  -- người gọi là owner và không tự hạ quyền nên luôn còn ≥ 1 owner; vẫn kiểm tra cho chắc
  if not exists (select 1 from platform_admins where role = 'owner') then
    raise exception 'Phải còn ít nhất một chủ sở hữu' using errcode = '22023';
  end if;
  perform _admin_audit('user.role_' || _role, 'user', _user, null,
                       jsonb_build_object('from', coalesce(v_old, 'member'), 'to', _role));
end $$;

-- ---------- Khóa / mở khóa tài khoản (quản trị viên trở lên) ----------
create or replace function public.admin_set_user_banned(_user uuid, _ban boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_deleted boolean;
begin
  perform _require_role('admin');
  if _user = auth.uid() then
    raise exception 'Không thể tự khóa tài khoản của chính mình' using errcode = '42501';
  end if;
  select deleted_at is not null into v_deleted from auth.users where id = _user for update;
  if not found then raise exception 'Không tìm thấy người dùng' using errcode = 'P0002'; end if;
  if v_deleted then raise exception 'Tài khoản đã bị xóa' using errcode = '22023'; end if;
  if exists (select 1 from platform_admins where user_id = _user) then
    raise exception 'Không thể khóa nhân sự quản trị — hạ về thành viên trước' using errcode = '42501';
  end if;
  if _ban and coalesce(trim(_reason), '') = '' then
    raise exception 'Cần nhập lý do khóa' using errcode = '22023';
  end if;

  if _ban then
    -- mốc hữu hạn: GoTrue lỗi 500 với 'infinity' (xem 20261119090600)
    update auth.users set banned_until = now() + interval '100 years' where id = _user;
    delete from auth.sessions where user_id = _user;   -- đăng xuất mọi thiết bị
  else
    update auth.users set banned_until = null where id = _user;
  end if;
  perform _admin_audit(case when _ban then 'user.banned' else 'user.unbanned' end, 'user', _user, null,
                       jsonb_build_object('reason', _reason));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_users(text, int, int, text)',
    'admin_set_user_role(uuid, text)',
    'admin_set_user_banned(uuid, boolean, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
