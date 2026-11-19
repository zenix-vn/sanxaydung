-- =============================================================
-- 20260728090000_missing_features.sql
-- Bổ sung các tính năng còn thiếu theo tài liệu thiết kế:
--   1. Trigger profile_completeness (tự tính % hoàn thiện hồ sơ)
--   2. Trigger verified_tier (nâng cấp khi xác minh được duyệt)
--   3. Trigger like_count (đếm lượt thích bài viết)
--   4. Trigger last_message_at (cập nhật thời gian tin nhắn cuối)
--   5. Realtime publication
--   6. RPC export_my_data (tuân thủ Nghị định 13/2023)
--   7. RPC delete_my_account (quyền xóa tài khoản cá nhân)
-- =============================================================


-- ================================================================
-- 1. TRIGGER profile_completeness
--    Tính % hoàn thiện hồ sơ mỗi khi companies được INSERT/UPDATE.
-- ================================================================

create or replace function public.calc_profile_completeness()
returns trigger language plpgsql as $$
declare
  score int := 0;
begin
  -- Mỗi trường = 1 điểm; tổng 10 trường → * 10 = 0..100
  if nullif(trim(coalesce(new.name,'')), '')        is not null then score := score + 1; end if;
  if nullif(trim(coalesce(new.intro,'')), '')        is not null then score := score + 1; end if;
  if nullif(trim(coalesce(new.description,'')), '')  is not null then score := score + 1; end if;
  if new.logo_url                                    is not null then score := score + 1; end if;
  if new.cover_url                                   is not null then score := score + 1; end if;
  if nullif(trim(coalesce(new.phone,'')), '')        is not null then score := score + 1; end if;
  if nullif(trim(coalesce(new.address,'')), '')      is not null then score := score + 1; end if;
  if new.province_code                               is not null then score := score + 1; end if;
  if new.founded_year                                is not null then score := score + 1; end if;
  if nullif(trim(coalesce(new.website,'')), '')      is not null then score := score + 1; end if;

  new.profile_completeness := score * 10;
  return new;
end $$;

drop trigger if exists t_companies_completeness on public.companies;
create trigger t_companies_completeness
  before insert or update
  on public.companies
  for each row execute function public.calc_profile_completeness();


-- ================================================================
-- 2. TRIGGER verified_tier
--    Khi company_verifications.status → 'verified', nâng verified_tier:
--      tax | business_license → 'legal'
--      capability_cert       → 'capability'
--    (Gold được tính trong compute_trust_score hoặc admin set thủ công)
-- ================================================================

create or replace function public.update_verified_tier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_has_legal  boolean;
  v_has_cap    boolean;
  v_new_tier   text;
begin
  -- Chỉ kích hoạt khi status chuyển sang 'verified'
  if new.status <> 'verified' then
    return new;
  end if;

  select
    exists (select 1 from company_verifications
            where company_id = new.company_id
              and kind in ('tax','business_license')
              and status = 'verified'),
    exists (select 1 from company_verifications
            where company_id = new.company_id
              and kind = 'capability_cert'
              and status = 'verified')
  into v_has_legal, v_has_cap;

  -- Bao gồm cả bản ghi vừa thay đổi
  if new.kind = 'capability_cert' then v_has_cap  := true; end if;
  if new.kind in ('tax','business_license') then v_has_legal := true; end if;

  v_new_tier := case
    when v_has_cap  then 'capability'
    when v_has_legal then 'legal'
    else 'none'
  end;

  -- Không hạ cấp 'gold' (gold được set riêng)
  update public.companies
     set verified_tier = v_new_tier
   where id = new.company_id
     and verified_tier <> 'gold'
     and verified_tier <> v_new_tier;

  -- Tính lại Trust Score ngay
  perform public.compute_trust_score(new.company_id);

  return new;
end $$;

drop trigger if exists t_verified_tier on public.company_verifications;
create trigger t_verified_tier
  after insert or update of status
  on public.company_verifications
  for each row execute function public.update_verified_tier();


-- ================================================================
-- 3. TRIGGER like_count
--    post_reactions INSERT/DELETE → cập nhật posts.like_count
-- ================================================================

create or replace function public.bump_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists t_like_count on public.post_reactions;
create trigger t_like_count
  after insert or delete
  on public.post_reactions
  for each row execute function public.bump_like_count();


-- ================================================================
-- 4. TRIGGER last_message_at
--    Mỗi khi có tin nhắn mới → cập nhật conversations.last_message_at
-- ================================================================

create or replace function public.touch_conversation()
returns trigger language plpgsql as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return null;
end $$;

drop trigger if exists t_conversation_touch on public.messages;
create trigger t_conversation_touch
  after insert
  on public.messages
  for each row execute function public.touch_conversation();


-- ================================================================
-- 5. REALTIME PUBLICATION
--    Thêm bảng messages và notifications vào publication để
--    Supabase Realtime đẩy thay đổi về client (chat, thông báo).
-- ================================================================

do $$
begin
  -- Thêm vào publication nếu chưa có (bỏ qua lỗi nếu publication chưa tồn tại)
  begin
    alter publication supabase_realtime add table public.messages;
  exception when others then
    raise notice 'Không thể thêm messages vào supabase_realtime: %', sqlerrm;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when others then
    raise notice 'Không thể thêm notifications vào supabase_realtime: %', sqlerrm;
  end;
end $$;


-- ================================================================
-- 6. RPC export_my_data
--    Xuất toàn bộ dữ liệu cá nhân theo yêu cầu NĐ 13/2023/NĐ-CP.
--    Trả về JSON gộp profiles, posts, marketplace_listings, reviews.
-- ================================================================

create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  result jsonb;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select to_jsonb(p) from profiles p where p.id = v_uid
    ),
    'companies', (
      select jsonb_agg(to_jsonb(c))
      from companies c
      where c.owner_id = v_uid and c.deleted_at is null
    ),
    'memberships', (
      select jsonb_agg(to_jsonb(cm))
      from company_members cm
      where cm.user_id = v_uid and cm.status = 'active'
    ),
    'posts', (
      select jsonb_agg(to_jsonb(po))
      from posts po
      where po.author_id = v_uid and po.deleted_at is null
    ),
    'marketplace_listings', (
      select jsonb_agg(to_jsonb(ml))
      from marketplace_listings ml
      where ml.author_id = v_uid and ml.deleted_at is null
    ),
    'notifications', (
      select jsonb_agg(to_jsonb(n))
      from notifications n
      where n.user_id = v_uid
      order by n.created_at desc
      limit 500
    )
  ) into result;

  return result;
end $$;

-- Chỉ user đăng nhập mới gọi được (auth.uid() kiểm tra bên trong)
revoke execute on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;


-- ================================================================
-- 7. RPC delete_my_account
--    Xóa mềm + ẩn danh hóa dữ liệu cá nhân. KHÔNG xóa vật lý
--    để bảo toàn tính toàn vẹn nội dung (bài viết, đánh giá).
-- ================================================================

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;

  -- Ẩn danh hóa profile (không xóa vật lý vì FK)
  update public.profiles
     set full_name  = 'Người dùng đã xóa',
         avatar_url = null,
         phone      = null,
         updated_at = now()
   where id = v_uid;

  -- Gỡ thành viên khỏi tất cả công ty
  update public.company_members
     set status = 'removed'
   where user_id = v_uid;

  -- Rút quyền sở hữu công ty (owner_id về null, company vẫn tồn tại)
  update public.companies
     set owner_id = null
   where owner_id = v_uid;

  -- Xóa thông báo (không cần giữ lại)
  delete from public.notifications where user_id = v_uid;

  -- Hủy phiên trong auth.users (Supabase xử lý xóa vật lý qua admin API)
  -- Ghi audit log
  insert into public.audit_log (actor_id, action, entity_type, entity_id)
    values (v_uid, 'account.delete_self', 'profile', v_uid);
end $$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- ================================================================
-- 8. pg_cron: Daily digest (bổ sung cron còn thiếu)
-- ================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'daily-digest') then
      perform cron.unschedule('daily-digest');
    end if;
    -- Gọi Edge Function daily-digest lúc 07:00 mỗi ngày (nếu đã deploy)
    -- Dùng net.http_post nếu extension pg_net có sẵn; bỏ qua nếu không
    begin
      perform cron.schedule('daily-digest', '0 7 * * *',
        $job$
          select net.http_post(
            url := current_setting('app.edge_function_url', true) || '/notify-dispatch',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            ),
            body := '{"type":"daily_digest"}'::jsonb
          );
        $job$
      );
    exception when others then
      raise notice 'Không đăng ký được daily-digest cron: %', sqlerrm;
    end;
  end if;
end $$;
