-- =============================================================
-- Thành viên & lời mời doanh nghiệp (frontend /dashboard/members, /moi/[token])
--   1. Bỏ policy cm_write (admin công ty sửa được cả dòng owner / tự nâng lên owner)
--      → mọi thay đổi thành viên đi qua RPC có kiểm tra.
--   2. invite_member      : admin mời theo email, trả token (link /moi/<token>)
--   3. get_invitation     : xem thông tin lời mời theo token (trang nhận lời mời)
--   4. accept_invitation  : người được mời (đúng email đăng nhập) nhận lời mời
--   5. revoke_invitation  : admin thu hồi lời mời chưa dùng
--   6. set_member_role    : đổi vai trò (không đụng owner, không tự đổi mình)
--   7. remove_member      : admin gỡ thành viên / thành viên tự rời công ty
-- =============================================================

drop policy if exists cm_write on public.company_members;

create index if not exists company_invitations_company_idx on public.company_invitations (company_id, created_at desc);
create index if not exists company_invitations_email_idx on public.company_invitations (lower(email));

-- ---------- 2. invite_member ----------
create or replace function public.invite_member(_company uuid, _email text, _role text default 'member')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(trim(coalesce(_email, '')));
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_name  text;
  v_user  uuid;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  if not is_company_member(_company, 'admin') then
    raise exception 'Chỉ chủ sở hữu/quản trị mới mời được thành viên' using errcode = '42501';
  end if;
  if _role not in ('admin', 'editor', 'member') then
    raise exception 'Vai trò không hợp lệ' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email không hợp lệ' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = v_email limit 1;
  if v_user is not null and exists (
       select 1 from company_members where company_id = _company and user_id = v_user and status = 'active') then
    raise exception 'Người này đã là thành viên của doanh nghiệp' using errcode = '23505';
  end if;
  -- Chống spam: tối đa 30 lời mời / công ty / ngày
  if (select count(*) from company_invitations
       where company_id = _company and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Đã đạt giới hạn lời mời trong ngày' using errcode = '54000';
  end if;

  -- Lời mời cũ chưa dùng cho cùng email → hết hiệu lực
  update company_invitations set expires_at = now()
   where company_id = _company and lower(email) = v_email and accepted_at is null and expires_at > now();

  insert into company_invitations(company_id, email, role, token, invited_by, expires_at)
    values (_company, v_email, _role, v_token, v_uid, now() + interval '7 days');

  -- Người được mời đã có tài khoản → thông báo trong app (webhook sẽ gửi email nếu bật)
  if v_user is not null then
    select name into v_name from companies where id = _company;
    insert into notifications(user_id, company_id, type, title, body, link)
      values (v_user, _company, 'member_invite', 'Lời mời tham gia doanh nghiệp',
              format('Bạn được mời tham gia %s trên Sàn Xây Dựng.', v_name), '/moi/' || v_token);
  end if;

  insert into audit_log(actor_id, company_id, action, entity_type, diff)
    values (v_uid, _company, 'member.invite', 'company_invitation', jsonb_build_object('email', v_email, 'role', _role));
  return v_token;
end $$;
revoke execute on function public.invite_member(uuid, text, text) from public, anon;
grant  execute on function public.invite_member(uuid, text, text) to authenticated;

-- ---------- 3. get_invitation ----------
create or replace function public.get_invitation(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'company_id', c.id, 'company_name', c.name, 'company_slug', c.slug, 'logo_url', c.logo_url,
    'role', i.role,
    -- chỉ hé lộ email dạng che để người nhận biết lời mời gửi cho tài khoản nào
    'email_hint', regexp_replace(i.email, '^(.).*(@.*)$', '\1***\2'),
    'email_match', lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', '')),
    'expired', i.expires_at <= now(),
    'accepted', i.accepted_at is not null)
  from company_invitations i join companies c on c.id = i.company_id
  where i.token = _token and length(_token) >= 32;
$$;
revoke execute on function public.get_invitation(text) from public;
grant  execute on function public.get_invitation(text) to anon, authenticated;

-- ---------- 4. accept_invitation ----------
create or replace function public.accept_invitation(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  i       company_invitations;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  select * into i from company_invitations where token = _token for update;
  if not found then
    raise exception 'Lời mời không tồn tại' using errcode = 'P0002';
  end if;
  if i.accepted_at is not null then
    raise exception 'Lời mời đã được sử dụng' using errcode = '22023';
  end if;
  if i.expires_at <= now() then
    raise exception 'Lời mời đã hết hạn' using errcode = '22023';
  end if;
  if lower(i.email) <> v_email then
    raise exception 'Lời mời này gửi tới email khác với tài khoản đang đăng nhập' using errcode = '42501';
  end if;

  insert into company_members(company_id, user_id, role, status)
    values (i.company_id, v_uid, i.role, 'active')
  on conflict (company_id, user_id) do update
    set status = 'active',
        -- không hạ quyền người đang là owner
        role = case when company_members.role = 'owner' then 'owner' else excluded.role end;

  update company_invitations set accepted_at = now() where id = i.id;

  perform notify_company(i.company_id, 'member_joined', 'Thành viên mới',
    format('%s đã nhận lời mời tham gia doanh nghiệp.', v_email), '/dashboard/members');
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id)
    values (v_uid, i.company_id, 'member.accept_invite', 'company_invitation', i.id);
  return i.company_id;
end $$;
revoke execute on function public.accept_invitation(text) from public, anon;
grant  execute on function public.accept_invitation(text) to authenticated;

-- ---------- 5. revoke_invitation ----------
create or replace function public.revoke_invitation(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from company_invitations where id = _id and accepted_at is null;
  if v_company is null or not is_company_member(v_company, 'admin') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  update company_invitations set expires_at = now() where id = _id;
end $$;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
grant  execute on function public.revoke_invitation(uuid) to authenticated;

-- ---------- 6. set_member_role ----------
create or replace function public.set_member_role(_member uuid, _role text)
returns void language plpgsql security definer set search_path = public as $$
declare m company_members;
begin
  select * into m from company_members where id = _member;
  if not found or not is_company_member(m.company_id, 'admin') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  if _role not in ('admin', 'editor', 'member') then
    raise exception 'Vai trò không hợp lệ' using errcode = '22023';
  end if;
  if m.role = 'owner' then
    raise exception 'Không thể đổi vai trò của chủ sở hữu' using errcode = '42501';
  end if;
  if m.user_id = auth.uid() then
    raise exception 'Không thể tự đổi vai trò của mình' using errcode = '42501';
  end if;
  update company_members set role = _role where id = _member;
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
    values (auth.uid(), m.company_id, 'member.set_role', 'company_member', _member,
            jsonb_build_object('from', m.role, 'to', _role));
end $$;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
grant  execute on function public.set_member_role(uuid, text) to authenticated;

-- ---------- 7. remove_member ----------
create or replace function public.remove_member(_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m company_members;
begin
  select * into m from company_members where id = _member and status = 'active';
  if not found then
    raise exception 'Không tìm thấy thành viên' using errcode = 'P0002';
  end if;
  if m.role = 'owner' then
    raise exception 'Không thể gỡ chủ sở hữu (liên hệ quản trị sàn để chuyển quyền)' using errcode = '42501';
  end if;
  -- tự rời công ty, hoặc admin gỡ người khác
  if m.user_id <> auth.uid() and not is_company_member(m.company_id, 'admin') then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  update company_members set status = 'removed' where id = _member;
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id)
    values (auth.uid(), m.company_id,
            case when m.user_id = auth.uid() then 'member.leave' else 'member.remove' end,
            'company_member', _member);
end $$;
revoke execute on function public.remove_member(uuid) from public, anon;
grant  execute on function public.remove_member(uuid) to authenticated;
