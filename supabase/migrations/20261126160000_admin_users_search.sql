-- =============================================================
-- 20261126160000_admin_users_search.sql
--   admin_user_detail    hồ sơ một người dùng: doanh nghiệp, claim, báo cáo, đăng nhập, thiết bị
--   admin_signout_user   đăng xuất khỏi mọi thiết bị
--   admin_view_as_user   xem CHỈ ĐỌC những gì người dùng đang thấy (chỉ chủ sở hữu, luôn ghi nhật ký).
--                        Không tạo phiên đăng nhập thay người dùng, không trả nội dung tin nhắn.
--   admin_search         tìm chung theo tên / SĐT / MST / email
-- =============================================================

create or replace function public.admin_user_detail(_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform _require_role('admin');
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'phone', coalesce(p.phone, u.phone::text), 'avatar_url', p.avatar_url,
    'email', u.email, 'email_confirmed', u.email_confirmed_at is not null,
    'providers', (select coalesce(jsonb_agg(distinct i.provider), '[]') from auth.identities i where i.user_id = p.id),
    'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'banned', u.banned_until is not null and u.banned_until > now(), 'deleted', u.deleted_at is not null,
    'role', (select role from platform_admins where user_id = p.id),
    'companies', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'status', c.status,
               'role', m.role, 'member_status', m.status, 'is_owner', c.owner_id = p.id, 'deleted', c.deleted_at is not null)
             order by c.name), '[]')
        from company_members m join companies c on c.id = m.company_id
       where m.user_id = p.id and m.status <> 'removed'),
    'claims', (
      select coalesce(jsonb_agg(jsonb_build_object('id', cl.id, 'company_id', c.id, 'company', c.name, 'method', cl.method,
               'status', cl.status, 'note', cl.note, 'created_at', cl.created_at) order by cl.created_at desc), '[]')
        from company_claims cl join companies c on c.id = cl.company_id where cl.user_id = p.id),
    'reports_filed', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select created_at, jsonb_build_object('id', id, 'entity_type', entity_type, 'reason', reason, 'status', status, 'created_at', created_at) j
          from reports where reporter_id = p.id order by created_at desc limit 20) x),
    'reports_against', (
      select count(*) from reports rp
       where rp.entity_id in (
         select company_id from company_members where user_id = p.id and role = 'owner' and status = 'active'
         union select id from posts where author_id = p.id
         union select id from marketplace_listings where author_id = p.id)),
    'logins', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select a.created_at, jsonb_build_object('action', a.payload ->> 'action', 'ip', nullif(a.ip_address, ''), 'created_at', a.created_at) j
          from auth.audit_log_entries a
         where a.payload ->> 'actor_id' = p.id::text and a.payload ->> 'action' in ('login', 'logout', 'user_signedup')
         order by a.created_at desc limit 15) x),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object('created_at', s.created_at,
               'last_seen', coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
               'user_agent', s.user_agent, 'ip', host(s.ip)) order by s.created_at desc), '[]')
        from auth.sessions s where s.user_id = p.id and (s.not_after is null or s.not_after > now())),
    'history', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select a.created_at, jsonb_build_object('id', a.id, 'action', a.action, 'actor', ap.full_name, 'diff', a.diff, 'created_at', a.created_at) j
          from audit_log a left join profiles ap on ap.id = a.actor_id
         where a.entity_id = p.id or a.actor_id = p.id
         order by a.created_at desc limit 20) x)
  ) into r
  from profiles p left join auth.users u on u.id = p.id
  where p.id = _user;
  return r;
end $$;

create or replace function public.admin_signout_user(_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform _require_role('admin');
  if _user = auth.uid() then raise exception 'Dùng nút Đăng xuất cho tài khoản của chính bạn' using errcode = '42501'; end if;
  if exists (select 1 from platform_admins where user_id = _user) and not has_platform_role('owner') then
    raise exception 'Chỉ Chủ sở hữu được đăng xuất nhân sự quản trị' using errcode = '42501';
  end if;
  delete from auth.sessions where user_id = _user;
  get diagnostics n = row_count;
  perform _admin_audit('user.signed_out', 'user', _user, null, jsonb_build_object('sessions', n));
  return n;
end $$;

create or replace function public.admin_view_as_user(_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  perform _require_role('owner');
  if not exists (select 1 from profiles where id = _user) then raise exception 'Không tìm thấy người dùng' using errcode = 'P0002'; end if;
  perform _admin_audit('user.viewed_as', 'user', _user, null, '{}');
  with my as (select company_id from company_members where user_id = _user and status = 'active')
  select jsonb_build_object(
    'companies', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'status', c.status, 'verified_tier', c.verified_tier,
               'completeness', c.profile_completeness, 'trust_score', c.trust_score, 'role', m.role,
               'plan', (select pl.name from subscriptions s join plans pl on pl.id = s.plan_id
                         where s.company_id = c.id and s.status = 'active' and (s.expires_at is null or s.expires_at > now())
                         order by s.expires_at desc nulls first limit 1),
               'unclaimed_fields', array_remove(array[
                   case when c.logo_url is null then 'logo' end, case when c.cover_url is null then 'ảnh bìa' end,
                   case when nullif(c.intro, '') is null then 'giới thiệu' end, case when nullif(c.address, '') is null then 'địa chỉ' end], null)
             ) order by c.name), '[]')
        from company_members m join companies c on c.id = m.company_id
       where m.user_id = _user and m.status = 'active' and c.deleted_at is null),
    'notifications', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select created_at, jsonb_build_object('title', title, 'body', body, 'link', link, 'is_read', is_read, 'created_at', created_at) j
          from notifications where user_id = _user order by created_at desc limit 20) x),
    'unread', (select count(*) from notifications where user_id = _user and not is_read),
    'listings', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'status', l.status, 'quotes', l.quote_count, 'created_at', l.created_at) order by l.created_at desc), '[]')
        from marketplace_listings l where l.company_id in (select company_id from my) and l.deleted_at is null),
    'quotes', (
      select coalesce(jsonb_agg(jsonb_build_object('listing_id', l.id, 'title', l.title, 'amount', q.amount, 'status', q.status, 'created_at', q.created_at) order by q.created_at desc), '[]')
        from quotes q join marketplace_listings l on l.id = q.listing_id where q.company_id in (select company_id from my)),
    'conversations', (select count(distinct conversation_id) from conversation_participants where company_id in (select company_id from my))
  ) into r;
  return r;
end $$;

create or replace function public.admin_search(_q text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := trim(coalesce(_q, ''));
  v_like text;
  v_digits text := regexp_replace(coalesce(_q, ''), '\D', '', 'g');
  v_phone text := normalize_phone(_q);
begin
  perform _require_role('moderator');
  if length(v_q) < 2 then return jsonb_build_object('companies', '[]'::jsonb, 'users', '[]'::jsonb); end if;
  -- ký tự đại diện trong từ khóa được hiểu theo nghĩa đen
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return jsonb_build_object(
    'companies', (
      select coalesce(jsonb_agg(x.j), '[]') from (
        select jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'tax_code', c.tax_code, 'status', c.status, 'has_owner', c.owner_id is not null) j
          from companies c
         where c.deleted_at is null
           and (unaccent(c.name) ilike unaccent(v_like) or c.slug ilike v_like or c.email ilike v_like or c.legal_name ilike v_like
                or (length(v_digits) >= 6 and v_q ~ '^[0-9 .+()-]+$'
                    and (normalize_phone(c.phone) like '%' || v_phone || '%' or regexp_replace(coalesce(c.tax_code, ''), '\D', '', 'g') like '%' || v_digits || '%')))
         order by (unaccent(c.name) ilike unaccent(replace(replace(v_q, '%', ''), '_', '') || '%')) desc, c.name
         limit 8) x),
    'users', case when not has_platform_role('admin') then '[]'::jsonb else (
      select coalesce(jsonb_agg(x.j), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', u.email, 'phone', coalesce(p.phone, u.phone::text)) j
          from profiles p left join auth.users u on u.id = p.id
         where u.deleted_at is null
           and (unaccent(coalesce(p.full_name, '')) ilike unaccent(v_like) or u.email ilike v_like
                or (length(v_digits) >= 6 and v_q ~ '^[0-9 .+()-]+$' and normalize_phone(coalesce(p.phone, u.phone::text)) like '%' || v_phone || '%'))
         order by p.created_at desc
         limit 6) x) end);
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_user_detail(uuid)', 'admin_signout_user(uuid)', 'admin_view_as_user(uuid)', 'admin_search(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
