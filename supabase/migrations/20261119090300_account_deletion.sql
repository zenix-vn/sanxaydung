-- =============================================================
-- 20261119090300_account_deletion.sql
-- delete_my_account: bản cũ chỉ ẩn danh profile nhưng auth.users còn nguyên
-- → người dùng đăng nhập lại được bằng email/SĐT/Google cũ.
-- Bản mới khóa hẳn tài khoản đăng nhập (không xoá vật lý vì posts/reviews/audit_log
-- còn FK tới profiles) và thu hồi phiên hiện có.
-- =============================================================

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id)
    values (v_uid, 'account.delete_self', 'profile', v_uid);

  -- Ẩn danh hoá dữ liệu cá nhân
  update public.profiles
     set full_name = 'Người dùng đã xóa', avatar_url = null, phone = null, updated_at = now()
   where id = v_uid;

  update public.company_members set status = 'removed' where user_id = v_uid;
  update public.companies set owner_id = null where owner_id = v_uid;

  delete from public.notifications      where user_id = v_uid;
  delete from public.notification_prefs where user_id = v_uid;
  delete from public.post_reactions     where user_id = v_uid;   -- trigger t_like_count trừ lại bộ đếm

  -- Khoá đăng nhập: gỡ liên kết (email/SĐT/Google), thu hồi phiên, cấm vĩnh viễn.
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions   where user_id = v_uid;   -- refresh_tokens xoá theo (cascade)
  update auth.users
     set banned_until        = 'infinity',
         deleted_at          = now(),
         email               = 'deleted-' || v_uid::text || '@deleted.invalid',
         phone               = null,
         encrypted_password  = null,
         raw_user_meta_data  = '{}'::jsonb
   where id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
