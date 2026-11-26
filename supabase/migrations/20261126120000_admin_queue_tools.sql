-- =============================================================
-- 20261126120000_admin_queue_tools.sql
-- Công cụ cho các hàng chờ trong /admin:
--   - người đang xử lý (tránh hai người làm trùng một mục) + ghi chú nội bộ
--   - duyệt / từ chối hàng loạt, trả kết quả từng mục
--   - lý do từ chối được gửi cho người dùng qua thông báo
--   - đăng ký đối tác đã xử lý không bị xử lý lần nữa
-- =============================================================

create table if not exists public.admin_work_items (
  kind        text not null check (kind in ('verification', 'claim', 'registration', 'report')),
  entity_id   uuid not null,
  assignee    uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz,
  primary key (kind, entity_id)
);
create table if not exists public.admin_notes (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('verification', 'claim', 'registration', 'report')),
  entity_id  uuid not null,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists admin_notes_entity_idx on public.admin_notes (kind, entity_id, created_at);
-- Dữ liệu nội bộ: không có policy, client chỉ truy cập qua hàm security definer
alter table public.admin_work_items enable row level security;
alter table public.admin_notes enable row level security;
revoke all on public.admin_work_items, public.admin_notes from anon, authenticated;

create or replace function public.admin_queue_meta(_kind text, _ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _require_role('moderator');
  return (
    select coalesce(jsonb_object_agg(i.id, jsonb_build_object(
             'assignee', w.assignee,
             'assignee_name', coalesce(nullif(p.full_name, ''), u.email, 'Nhân sự'),
             'notes', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', n.id, 'body', n.body, 'created_at', n.created_at,
                          'author', coalesce(nullif(a.full_name, ''), 'Nhân sự')) order by n.created_at), '[]')
                         from admin_notes n left join profiles a on a.id = n.author_id
                        where n.kind = _kind and n.entity_id = i.id))), '{}')
      from unnest(_ids) i(id)
      left join admin_work_items w on w.kind = _kind and w.entity_id = i.id
      left join profiles p on p.id = w.assignee
      left join auth.users u on u.id = w.assignee);
end $$;

-- Nhận (_take) hoặc bỏ nhận. Không giành việc của người khác trừ khi _force.
create or replace function public.admin_assign(_kind text, _ids uuid[], _take boolean, _force boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform _require_role('moderator');
  if coalesce(array_length(_ids, 1), 0) > 100 then
    raise exception 'Tối đa 100 mục mỗi lần' using errcode = '22023';
  end if;
  if _take then
    insert into admin_work_items as w (kind, entity_id, assignee, assigned_at)
      select _kind, id, auth.uid(), now() from (select distinct unnest(_ids) as id) s
    on conflict (kind, entity_id) do update set assignee = excluded.assignee, assigned_at = now()
      where w.assignee is null or w.assignee = excluded.assignee or _force;
  else
    update admin_work_items set assignee = null, assigned_at = null
     where kind = _kind and entity_id = any(_ids)
       and (assignee = auth.uid() or has_platform_role('admin'));
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_add_note(_kind text, _id uuid, _body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_role('moderator');
  if nullif(trim(coalesce(_body, '')), '') is null then
    raise exception 'Ghi chú đang trống' using errcode = '22023';
  end if;
  insert into admin_notes(kind, entity_id, author_id, body) values (_kind, _id, auth.uid(), left(trim(_body), 2000));
end $$;

-- ---------- Claim: thêm lý do + báo cho người gửi ----------
drop function if exists public.admin_review_claim(uuid, boolean);
create or replace function public.admin_review_claim(_claim uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_company uuid; v_name text;
begin
  perform _require_admin();
  perform public.approve_company_claim(_claim, _approve, auth.uid());
  select cl.user_id, cl.company_id, c.name into v_user, v_company, v_name
    from company_claims cl join companies c on c.id = cl.company_id where cl.id = _claim;
  insert into notifications(user_id, company_id, type, title, body, link, data)
    values (v_user, case when _approve then v_company end, 'claim_result',
      case when _approve then 'Yêu cầu nhận hồ sơ được duyệt' else 'Yêu cầu nhận hồ sơ bị từ chối' end,
      case when _approve then format('Bạn đã được quản lý hồ sơ "%s".', v_name)
           else format('Hồ sơ "%s".', v_name) || coalesce(' Lý do: ' || nullif(trim(_note), ''), '') end,
      case when _approve then '/dashboard' else '/dashboard/claim' end,
      jsonb_build_object('claim_id', _claim, 'approved', _approve));
end $$;

-- ---------- Xác minh: thông báo kèm lý do ----------
create or replace function public.trg_notify_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('verified', 'rejected') then
    perform notify_company(new.company_id, 'verification_result',
      case when new.status = 'verified' then 'Xác minh thành công' else 'Xác minh bị từ chối' end,
      'Yêu cầu xác minh ' || case new.kind when 'tax' then 'mã số thuế' when 'business_license' then 'giấy phép kinh doanh'
                                           else 'chứng chỉ năng lực' end || ' đã được xử lý.'
        || case when new.status = 'rejected' then coalesce(' Lý do: ' || nullif(trim(new.meta->>'admin_note'), ''), '') else '' end,
      '/dashboard/verify', jsonb_build_object('verification_id', new.id, 'status', new.status));
  end if;
  return null;
end $$;

-- ---------- Đăng ký đối tác: chỉ xử lý bản đang chờ + lưu lý do ----------
drop function if exists public.admin_review_registration(uuid, text);
create or replace function public.admin_review_registration(_reg uuid, _action text, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
  v_status text;
  v_dup text;
begin
  perform _require_admin();
  select status into v_status from partner_registrations where id = _reg for update;
  if not found then raise exception 'Không tìm thấy bản đăng ký' using errcode = 'P0002'; end if;
  if v_status <> 'pending' then raise exception 'Bản đăng ký đã được xử lý' using errcode = '22023'; end if;

  if _action = 'approve' then
    select c.name into v_dup
      from partner_registrations g
      join companies c on normalize_phone(c.phone) = normalize_phone(g.phone) and c.deleted_at is null
     where g.id = _reg and g.company_id is null
     limit 1;
    if v_dup is not null then
      raise exception 'SĐT này đã có hồ sơ "%" — hãy đánh dấu Trùng', v_dup using errcode = '23505';
    end if;
    v_company := public.promote_registration(_reg);
    update partner_registrations
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), company_id = v_company
     where id = _reg;
  elsif _action in ('reject', 'duplicate') then
    update partner_registrations
       set status = case when _action = 'reject' then 'rejected' else 'duplicate' end,
           reviewed_by = auth.uid(), reviewed_at = now(),
           payload = coalesce(payload, '{}') || jsonb_strip_nulls(jsonb_build_object('review_note', nullif(trim(_note), '')))
     where id = _reg;
  else
    raise exception 'Hành động không hợp lệ' using errcode = '22023';
  end if;
  perform _admin_audit('registration.' || _action, 'partner_registration', _reg, v_company,
                       jsonb_build_object('note', nullif(trim(_note), '')));
  return v_company;
end $$;

-- ---------- Xử lý hàng loạt ----------
create or replace function public.admin_bulk_review(_kind text, _ids uuid[], _action text, _note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_holder text;
  v_out jsonb := '[]';
begin
  perform _require_role('moderator');
  if coalesce(array_length(_ids, 1), 0) not between 1 and 100 then
    raise exception 'Chọn từ 1 đến 100 mục' using errcode = '22023';
  end if;
  if not coalesce(
       (_kind in ('verification', 'claim') and _action in ('approve', 'reject'))
    or (_kind = 'registration' and _action in ('approve', 'reject', 'duplicate'))
    or (_kind = 'report' and _action in ('resolved', 'dismissed')), false) then
    raise exception 'Thao tác không hợp lệ' using errcode = '22023';
  end if;
  if _action = 'reject' and nullif(trim(coalesce(_note, '')), '') is null then
    raise exception 'Cần nhập lý do từ chối' using errcode = '22023';
  end if;

  for v_id in select distinct unnest(_ids) loop
    select coalesce(nullif(p.full_name, ''), 'người khác') into v_holder
      from admin_work_items w join profiles p on p.id = w.assignee
     where w.kind = _kind and w.entity_id = v_id and w.assignee <> auth.uid();
    if found then
      v_out := v_out || jsonb_build_object('id', v_id, 'ok', false, 'message', 'Đang do ' || v_holder || ' xử lý');
      continue;
    end if;
    begin
      if _kind = 'verification' then
        perform admin_review_verification(v_id, _action = 'approve', _note);
      elsif _kind = 'claim' then
        perform admin_review_claim(v_id, _action = 'approve', _note);
      elsif _kind = 'registration' then
        perform admin_review_registration(v_id, _action, _note);
      else
        perform 1 from reports where id = v_id and status in ('open', 'reviewing') for update;
        if not found then raise exception 'Báo cáo đã được xử lý' using errcode = '22023'; end if;
        perform admin_resolve_report(v_id, _action, _note);
      end if;
      v_out := v_out || jsonb_build_object('id', v_id, 'ok', true);
    exception when others then
      v_out := v_out || jsonb_build_object('id', v_id, 'ok', false, 'message', sqlerrm);
    end;
  end loop;
  return v_out;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_queue_meta(text, uuid[])',
    'admin_assign(text, uuid[], boolean, boolean)',
    'admin_add_note(text, uuid, text)',
    'admin_review_claim(uuid, boolean, text)',
    'admin_review_registration(uuid, text, text)',
    'admin_bulk_review(text, uuid[], text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
