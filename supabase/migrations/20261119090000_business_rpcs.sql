-- =============================================================
-- 20261119090000_business_rpcs.sql
-- AI-1 · task #2: RPC nghiệp vụ + sửa lỗi quyền/bộ đếm
--   0. Thu hồi quyền gọi RPC của hàm nội bộ (anon/authenticated)
--   1. Sửa trigger đếm (like/quote/last_message) → security definer
--   2. Kết nối: create_connection (chống trùng), respond_connection, complete_connection
--   3. submit_review (kiểm tra đúng đối tác), request_verification (chống trùng)
--   4. toggle_like
--   5. Chat: start_conversation, list_conversations
--   6. Claim công ty chưa có chủ: company_claims, claim_company, approve_company_claim
--   7. Thông báo tự động (connections / quotes / reviews / verifications)
-- Quy ước: mọi RPC dùng auth.uid(); anon KHÔNG được gọi.
-- =============================================================


-- ================================================================
-- 0. Thu hồi quyền gọi hàm nội bộ
--    grants.sql cấp EXECUTE cho mọi hàm → anon có thể gọi hàm security definer
--    như promote_registration / sync_all_registrations qua PostgREST.
--    Các hàm này chỉ dành cho service_role (script import, Edge Function, cron).
-- ================================================================

revoke execute on function public.promote_registration(uuid)   from public, anon, authenticated;
revoke execute on function public.sync_registration(uuid)      from public, anon, authenticated;
revoke execute on function public.sync_all_registrations()     from public, anon, authenticated;
revoke execute on function public.compute_trust_score(uuid)    from public, anon, authenticated;


-- ================================================================
-- 1. Trigger đếm phải chạy với quyền chủ hàm
--    Bản cũ chạy bằng quyền người gọi → RLS của posts / marketplace_listings /
--    conversations chặn UPDATE khi người dùng không phải chủ → bộ đếm không tăng.
-- ================================================================

create or replace function public.bump_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

create or replace function public.bump_quote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.marketplace_listings set quote_count = quote_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.marketplace_listings set quote_count = greatest(quote_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end $$;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end $$;


-- ================================================================
-- 2. Kết nối giữa hai công ty
--    pending → accepted (bên nhận chấp nhận) → completed → mới được review
-- ================================================================

create or replace function public.create_connection(
  _target uuid, _as_company uuid, _listing uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_as_company, 'editor') then
    raise exception 'Không có quyền đại diện công ty' using errcode = '42501';
  end if;
  if _target = _as_company then
    raise exception 'Không thể kết nối với chính công ty mình' using errcode = '22023';
  end if;
  if not exists (select 1 from companies
                  where id = _target and status = 'published' and deleted_at is null) then
    raise exception 'Doanh nghiệp không tồn tại hoặc chưa công khai' using errcode = 'P0002';
  end if;

  -- Đã có kết nối đang mở giữa hai bên (cùng tin đăng) → trả lại, không tạo trùng
  select c.id into v_id
    from connections c
   where c.status in ('pending', 'accepted')
     and c.listing_id is not distinct from _listing
     and ((c.requester_company_id = _as_company and c.target_company_id = _target)
       or (c.requester_company_id = _target and c.target_company_id = _as_company))
   limit 1;
  if found then
    return v_id;
  end if;

  insert into connections(requester_company_id, target_company_id, listing_id)
    values (_as_company, _target, _listing) returning id into v_id;
  return v_id;
end $$;

-- Bên nhận chấp nhận / từ chối yêu cầu kết nối
create or replace function public.respond_connection(
  _connection uuid, _as_company uuid, _accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company, 'admin') then
    raise exception 'Chỉ admin/owner được phản hồi kết nối' using errcode = '42501';
  end if;
  update connections
     set status = case when _accept then 'accepted' else 'cancelled' end
   where id = _connection
     and target_company_id = _as_company
     and status = 'pending';
  if not found then
    raise exception 'Không có yêu cầu kết nối đang chờ' using errcode = 'P0002';
  end if;
end $$;

-- Hoàn tất: chỉ khi đã accepted (chống review khống trên kết nối chưa từng diễn ra)
create or replace function public.complete_connection(_connection uuid, _as_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company, 'admin') then
    raise exception 'Chỉ admin/owner được xác nhận hoàn tất' using errcode = '42501';
  end if;
  update connections set status = 'completed', completed_at = now()
   where id = _connection
     and status = 'accepted'
     and (requester_company_id = _as_company or target_company_id = _as_company);
  if not found then
    raise exception 'Kết nối chưa được chấp nhận hoặc không thuộc công ty này' using errcode = 'P0002';
  end if;
end $$;


-- ================================================================
-- 3. Review & xác minh
-- ================================================================

-- Bản cũ không kiểm tra _target → có thể review công ty bất kỳ bằng 1 kết nối hợp lệ.
create or replace function public.submit_review(
  _connection uuid, _reviewer uuid, _target uuid,
  _quality int, _progress int, _cost int, _cooperation int, _safety int, _warranty int,
  _comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_reviewer, 'admin') then
    raise exception 'Không có quyền đánh giá thay công ty' using errcode = '42501';
  end if;
  if _reviewer = _target then
    raise exception 'Không thể tự đánh giá' using errcode = '22023';
  end if;
  if not exists (
        select 1 from connections c
         where c.id = _connection and c.status = 'completed'
           and ((c.requester_company_id = _reviewer and c.target_company_id = _target)
             or (c.target_company_id = _reviewer and c.requester_company_id = _target))) then
    raise exception 'Chỉ đánh giá đối tác của một kết nối đã hoàn tất' using errcode = '42501';
  end if;

  insert into reviews(connection_id, reviewer_company_id, target_company_id,
      score_quality, score_progress, score_cost, score_cooperation, score_safety, score_warranty, comment)
    values (_connection, _reviewer, _target,
      _quality, _progress, _cost, _cooperation, _safety, _warranty, _comment)
    returning id into v_id;

  perform public.compute_trust_score(_target);
  return v_id;
end $$;

-- Cần có số/ghi chú tham chiếu hoặc file minh chứng; không gửi trùng khi đang chờ duyệt.
-- Thêm _cert_class (hạng năng lực) và _meta (lĩnh vực, ngày cấp...) theo yêu cầu của dashboard/verify.
-- Phải DROP bản 4 tham số: nếu để lại, PostgREST gặp 2 overload cùng tên.
drop function if exists public.request_verification(uuid, text, text, text);

create or replace function public.request_verification(
  _company uuid, _kind text,
  _reference text default null, _evidence_url text default null,
  _cert_class text default null, _meta jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_company, 'admin') then
    raise exception 'Chỉ admin/owner được gửi yêu cầu xác minh' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(_reference, '')), '') is null
     and nullif(trim(coalesce(_evidence_url, '')), '') is null then
    raise exception 'Cần cung cấp số tham chiếu hoặc file minh chứng' using errcode = '22023';
  end if;
  if exists (select 1 from company_verifications
              where company_id = _company and kind = _kind and status = 'pending') then
    raise exception 'Đã có yêu cầu xác minh loại này đang chờ duyệt' using errcode = '23505';
  end if;
  insert into company_verifications(company_id, kind, reference, evidence_url, cert_class, meta)
    values (_company, _kind, nullif(trim(_reference), ''), _evidence_url,
            nullif(trim(coalesce(_cert_class, '')), ''), coalesce(_meta, '{}'))
    returning id into v_id;
  return v_id;
end $$;


-- ================================================================
-- 4. Thích bài viết (bật/tắt). Trả về true nếu hiện đang "đã thích".
--    like_count do trigger t_like_count cập nhật.
-- ================================================================

create or replace function public.toggle_like(_post uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;
  if not exists (select 1 from posts
                  where id = _post and status = 'published' and deleted_at is null) then
    raise exception 'Bài viết không tồn tại' using errcode = 'P0002';
  end if;

  delete from post_reactions where post_id = _post and user_id = v_uid;
  if found then
    return false;
  end if;
  insert into post_reactions(post_id, user_id) values (_post, v_uid);
  return true;
end $$;


-- ================================================================
-- 5. Chat
-- ================================================================

-- Mở (hoặc lấy lại) hội thoại 2 bên theo ngữ cảnh. cp_write RLS không cho tự thêm
-- công ty đối tác vào participants, nên phải đi qua RPC này.
create or replace function public.start_conversation(
  _as_company uuid, _target uuid,
  _context_type text default 'company', _context_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_company_member(_as_company) then
    raise exception 'Không có quyền đại diện công ty' using errcode = '42501';
  end if;
  if _target = _as_company then
    raise exception 'Không thể chat với chính công ty mình' using errcode = '22023';
  end if;
  if not exists (select 1 from companies
                  where id = _target and status = 'published' and deleted_at is null) then
    raise exception 'Doanh nghiệp không tồn tại hoặc chưa công khai' using errcode = 'P0002';
  end if;

  select c.id into v_id
    from conversations c
   where c.context_type is not distinct from _context_type
     and c.context_id   is not distinct from _context_id
     and exists (select 1 from conversation_participants p
                  where p.conversation_id = c.id and p.company_id = _as_company)
     and exists (select 1 from conversation_participants p
                  where p.conversation_id = c.id and p.company_id = _target)
     and (select count(*) from conversation_participants p
           where p.conversation_id = c.id) = 2
   limit 1;
  if found then
    return v_id;
  end if;

  insert into conversations(context_type, context_id, created_by)
    values (_context_type, _context_id, auth.uid()) returning id into v_id;
  insert into conversation_participants(conversation_id, company_id)
    values (v_id, _as_company), (v_id, _target);
  return v_id;
end $$;

-- Danh sách hội thoại của 1 công ty kèm đối tác, tin cuối, số tin chưa đọc.
-- Không phải thành viên → trả về rỗng.
create or replace function public.list_conversations(_as_company uuid)
returns table (
  conversation_id    uuid,
  other_company_id   uuid,
  other_company_name text,
  other_company_slug text,
  other_logo_url     text,
  context_type       text,
  context_id         uuid,
  last_message_at    timestamptz,
  last_message_body  text,
  unread_count       bigint
)
language sql stable security definer set search_path = public as $$
  select c.id,
         oc.id, oc.name, oc.slug, oc.logo_url,
         c.context_type, c.context_id,
         c.last_message_at,
         (select m.body from messages m
           where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select count(*) from messages m
           where m.conversation_id = c.id
             and m.sender_company_id is distinct from _as_company
             and not (auth.uid() = any (coalesce(m.read_by, '{}'))))
    from conversations c
    join conversation_participants me
      on me.conversation_id = c.id and me.company_id = _as_company
    left join lateral (
         select p.company_id from conversation_participants p
          where p.conversation_id = c.id and p.company_id <> _as_company
          limit 1) o on true
    left join companies oc on oc.id = o.company_id
   where public.is_company_member(_as_company)
   order by c.last_message_at desc nulls last, c.created_at desc;
$$;


-- Bản cũ chỉ kiểm tra _as_company là công ty của người dùng, không kiểm tra
-- hội thoại có thuộc công ty đó → đánh dấu đã đọc được tin của hội thoại lạ.
create or replace function public.mark_read(_conversation uuid, _as_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company)
     or not exists (select 1 from conversation_participants
                     where conversation_id = _conversation and company_id = _as_company) then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;
  update messages
     set read_by = array_append(coalesce(read_by, '{}'), auth.uid())
   where conversation_id = _conversation
     and not (auth.uid() = any (coalesce(read_by, '{}')));
end $$;


-- ================================================================
-- 6. Claim công ty chưa có chủ (hồ sơ cold-start owner_id NULL)
--    - Tự động duyệt khi chứng minh được quyền sở hữu kênh liên hệ:
--        · SĐT đã xác thực (auth.users.phone_confirmed_at) trùng SĐT công ty, hoặc
--        · email đã xác thực trùng email công ty.
--    - Không chứng minh được → tạo yêu cầu 'pending' để admin duyệt thủ công.
--    profiles.phone do người dùng tự khai nên KHÔNG dùng làm bằng chứng.
-- ================================================================

create or replace function public.normalize_phone(_p text)
returns text language sql immutable as $$
  select case
           when d = '' then null
           when d like '84%' and length(d) >= 11 then '0' || substr(d, 3)
           else d
         end
    from (select regexp_replace(coalesce(_p, ''), '\D', '', 'g') as d) s;
$$;

create table if not exists public.company_claims (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  method        text not null check (method in ('phone', 'email', 'manual')),
  claimed_phone text,
  note          text,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid references public.profiles(id),
  reviewed_at   timestamptz,
  created_at    timestamptz default now()
);
create unique index if not exists company_claims_pending_uq
  on public.company_claims (company_id, user_id) where status = 'pending';
create index if not exists company_claims_status_idx
  on public.company_claims (status, created_at);

alter table public.company_claims enable row level security;
drop policy if exists claims_read_own on public.company_claims;
create policy claims_read_own on public.company_claims
  for select using (user_id = auth.uid());
-- Không có policy INSERT/UPDATE: chỉ ghi qua claim_company / approve_company_claim.

-- Gán chủ sở hữu (dùng chung cho auto-claim và duyệt tay)
create or replace function public._assign_company_owner(_company uuid, _user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update companies set owner_id = _user where id = _company and owner_id is null;
  if not found then
    raise exception 'Doanh nghiệp đã có chủ sở hữu' using errcode = '23505';
  end if;
  insert into company_members(company_id, user_id, role, status)
    values (_company, _user, 'owner', 'active')
  on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
end $$;
revoke execute on function public._assign_company_owner(uuid, uuid) from public, anon, authenticated;

-- Trả về 'claimed' (đã là chủ) hoặc 'pending' (chờ admin duyệt)
create or replace function public.claim_company(_company uuid, _note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  c        companies%rowtype;
  u        auth.users%rowtype;
  v_method text;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;

  select * into c from companies where id = _company and deleted_at is null;
  if not found then
    raise exception 'Không tìm thấy doanh nghiệp' using errcode = 'P0002';
  end if;
  if c.owner_id is not null
     or exists (select 1 from company_members
                 where company_id = _company and role = 'owner' and status = 'active') then
    raise exception 'Doanh nghiệp đã có chủ sở hữu' using errcode = '23505';
  end if;

  select * into u from auth.users where id = v_uid;
  if u.phone_confirmed_at is not null
     and normalize_phone(u.phone) is not null
     and normalize_phone(u.phone) = normalize_phone(c.phone) then
    v_method := 'phone';
  elsif u.email_confirmed_at is not null
     and nullif(trim(coalesce(c.email, '')), '') is not null
     and lower(u.email) = lower(trim(c.email)) then
    v_method := 'email';
  end if;

  if v_method is null then
    insert into company_claims(company_id, user_id, method, claimed_phone, note)
      select _company, v_uid, 'manual', p.phone, _note
        from profiles p where p.id = v_uid
    on conflict (company_id, user_id) where status = 'pending' do nothing;
    return 'pending';
  end if;

  perform public._assign_company_owner(_company, v_uid);
  insert into company_claims(company_id, user_id, method, claimed_phone, status, reviewed_at)
    values (_company, v_uid, v_method, c.phone, 'approved', now());
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
    values (v_uid, _company, 'company.claim', 'company', _company,
            jsonb_build_object('method', v_method));
  return 'claimed';
end $$;

-- Duyệt/từ chối tay — chỉ service_role (script/Edge Function admin)
create or replace function public.approve_company_claim(
  _claim uuid, _approve boolean default true, _reviewer uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare cl company_claims%rowtype;
begin
  select * into cl from company_claims where id = _claim and status = 'pending' for update;
  if not found then
    raise exception 'Không có yêu cầu claim đang chờ' using errcode = 'P0002';
  end if;
  if _approve then
    perform public._assign_company_owner(cl.company_id, cl.user_id);
  end if;
  update company_claims
     set status = case when _approve then 'approved' else 'rejected' end,
         reviewed_by = _reviewer, reviewed_at = now()
   where id = _claim;
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
    values (_reviewer, cl.company_id,
            case when _approve then 'company.claim_approved' else 'company.claim_rejected' end,
            'company_claim', _claim, jsonb_build_object('user_id', cl.user_id));
end $$;
revoke execute on function public.approve_company_claim(uuid, boolean, uuid) from public, anon, authenticated;
grant  execute on function public.approve_company_claim(uuid, boolean, uuid) to service_role;


-- ================================================================
-- 7. Thông báo tự động → bảng notifications (Realtime + notify-dispatch)
-- ================================================================

-- Gửi cho owner/admin đang hoạt động của công ty (+ owner_id nếu chưa có member)
create or replace function public.notify_company(
  _company uuid, _type text, _title text, _body text, _link text,
  _data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications(user_id, company_id, type, title, body, link, data)
  select s.uid, _company, _type, _title, _body, _link, _data
    from (
      select cm.user_id as uid
        from company_members cm
       where cm.company_id = _company and cm.status = 'active'
         and cm.role in ('owner', 'admin')
      union
      select c.owner_id
        from companies c
       where c.id = _company and c.owner_id is not null
    ) s
   where s.uid is not null;
end $$;
revoke execute on function public.notify_company(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.trg_notify_connection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_req text;
  v_tgt text;
begin
  select name into v_req from companies where id = new.requester_company_id;
  select name into v_tgt from companies where id = new.target_company_id;

  if tg_op = 'INSERT' then
    perform notify_company(new.target_company_id, 'connection_request',
      'Yêu cầu kết nối mới', v_req || ' muốn kết nối với bạn', '/dashboard',
      jsonb_build_object('connection_id', new.id));

  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform notify_company(new.requester_company_id, 'connection_accepted',
        'Kết nối được chấp nhận', v_tgt || ' đã chấp nhận kết nối', '/dashboard',
        jsonb_build_object('connection_id', new.id));
    elsif new.status = 'cancelled' then
      perform notify_company(new.requester_company_id, 'connection_declined',
        'Kết nối bị từ chối', v_tgt || ' đã từ chối kết nối', '/dashboard',
        jsonb_build_object('connection_id', new.id));
    elsif new.status = 'completed' then
      perform notify_company(new.requester_company_id, 'connection_completed',
        'Kết nối hoàn tất', 'Bạn có thể đánh giá ' || v_tgt, '/dashboard',
        jsonb_build_object('connection_id', new.id));
      perform notify_company(new.target_company_id, 'connection_completed',
        'Kết nối hoàn tất', 'Bạn có thể đánh giá ' || v_req, '/dashboard',
        jsonb_build_object('connection_id', new.id));
    end if;
  end if;
  return null;
end $$;

drop trigger if exists t_notify_connection on public.connections;
create trigger t_notify_connection
  after insert or update of status on public.connections
  for each row execute function public.trg_notify_connection();

create or replace function public.trg_notify_quote()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l marketplace_listings%rowtype;
  v_from text;
begin
  select * into l from marketplace_listings where id = new.listing_id;
  select name into v_from from companies where id = new.company_id;
  perform notify_company(l.company_id, 'new_quote',
    'Có báo giá mới', v_from || ' đã báo giá cho "' || l.title || '"',
    '/marketplace/' || l.id,
    jsonb_build_object('listing_id', l.id, 'quote_id', new.id));
  return null;
end $$;

drop trigger if exists t_notify_quote on public.quotes;
create trigger t_notify_quote
  after insert on public.quotes
  for each row execute function public.trg_notify_quote();

create or replace function public.trg_notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  select slug into v_slug from companies where id = new.target_company_id;
  perform notify_company(new.target_company_id, 'new_review',
    'Bạn nhận được đánh giá mới', 'Điểm trung bình: ' || coalesce(new.overall::text, '-'),
    '/cong-ty/' || v_slug,
    jsonb_build_object('review_id', new.id));
  return null;
end $$;

drop trigger if exists t_notify_review on public.reviews;
create trigger t_notify_review
  after insert on public.reviews
  for each row execute function public.trg_notify_review();

create or replace function public.trg_notify_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('verified', 'rejected') then
    perform notify_company(new.company_id, 'verification_result',
      case when new.status = 'verified' then 'Xác minh thành công' else 'Xác minh bị từ chối' end,
      'Yêu cầu xác minh (' || new.kind || ') đã được xử lý', '/dashboard/verify',
      jsonb_build_object('verification_id', new.id, 'status', new.status));
  end if;
  return null;
end $$;

drop trigger if exists t_notify_verification on public.company_verifications;
create trigger t_notify_verification
  after update of status on public.company_verifications
  for each row execute function public.trg_notify_verification();


-- ================================================================
-- Quyền gọi: chỉ người đã đăng nhập (default privileges đã cấp cho anon)
-- ================================================================

revoke execute on function public.create_connection(uuid, uuid, uuid)                       from public, anon;
revoke execute on function public.respond_connection(uuid, uuid, boolean)                   from public, anon;
revoke execute on function public.complete_connection(uuid, uuid)                           from public, anon;
revoke execute on function public.submit_review(uuid, uuid, uuid, int, int, int, int, int, int, text) from public, anon;
revoke execute on function public.request_verification(uuid, text, text, text, text, jsonb)  from public, anon;
revoke execute on function public.toggle_like(uuid)                                         from public, anon;
revoke execute on function public.start_conversation(uuid, uuid, text, uuid)                from public, anon;
revoke execute on function public.list_conversations(uuid)                                  from public, anon;
revoke execute on function public.claim_company(uuid, text)                                 from public, anon;
revoke execute on function public.mark_read(uuid, uuid)                                     from public, anon;

grant execute on function public.create_connection(uuid, uuid, uuid)                        to authenticated;
grant execute on function public.respond_connection(uuid, uuid, boolean)                    to authenticated;
grant execute on function public.complete_connection(uuid, uuid)                            to authenticated;
grant execute on function public.submit_review(uuid, uuid, uuid, int, int, int, int, int, int, text) to authenticated;
grant execute on function public.request_verification(uuid, text, text, text, text, jsonb)   to authenticated;
grant execute on function public.toggle_like(uuid)                                          to authenticated;
grant execute on function public.start_conversation(uuid, uuid, text, uuid)                 to authenticated;
grant execute on function public.list_conversations(uuid)                                   to authenticated;
grant execute on function public.claim_company(uuid, text)                                  to authenticated;
grant execute on function public.mark_read(uuid, uuid)                                      to authenticated;
