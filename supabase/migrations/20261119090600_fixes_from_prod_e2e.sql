-- =============================================================
-- 20261119090600_fixes_from_prod_e2e.sql
-- Hai lỗi chỉ lộ ra khi chạy trên Supabase thật (GoTrue + PostgREST):
--
-- 1) delete_my_account đặt banned_until='infinity'. GoTrue (Go) không đọc được giá trị này
--    ("unsupported Scan ... banned_until") → mọi thao tác admin lên user đã xóa lỗi 500.
--    Dùng mốc hữu hạn (GoTrue tự dùng 100 năm cho lệnh ban).
-- 2) Policy chat gọi in_conversation(); đã thu hồi EXECUTE của anon nên anon đọc messages /
--    conversations bị lỗi 401 thay vì nhận kết quả rỗng. Hàm trả false khi chưa đăng nhập → an toàn.
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

  update public.profiles
     set full_name = 'Người dùng đã xóa', avatar_url = null, phone = null, updated_at = now()
   where id = v_uid;

  update public.company_members set status = 'removed' where user_id = v_uid;
  update public.companies set owner_id = null where owner_id = v_uid;

  delete from public.notifications      where user_id = v_uid;
  delete from public.notification_prefs where user_id = v_uid;
  delete from public.post_reactions     where user_id = v_uid;

  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions   where user_id = v_uid;
  update auth.users
     set banned_until        = now() + interval '100 years',
         deleted_at          = now(),
         email               = 'deleted-' || v_uid::text || '@deleted.invalid',
         phone               = null,
         encrypted_password  = null,
         raw_user_meta_data  = '{}'::jsonb
   where id = v_uid;
end $$;

grant execute on function public.in_conversation(uuid) to anon;
