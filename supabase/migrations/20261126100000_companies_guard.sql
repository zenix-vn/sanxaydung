-- =============================================================
-- 20261126100000_companies_guard.sql
-- VÁ BẢO MẬT: policy companies_update/insert cho thành viên công ty ghi MỌI cột, nên chủ
-- hoặc biên tập viên có thể gọi thẳng API để tự cấp "Đối tác vàng", sửa Trust Score,
-- tự mở lại hồ sơ bị đình chỉ… Trigger này khóa các cột do hệ thống quản lý đối với
-- truy cập trực tiếp (role anon/authenticated). Hàm security definer (chạy dưới owner)
-- và service_role không bị ảnh hưởng.
-- Chủ hồ sơ vẫn đổi được draft <-> published như trước.
-- =============================================================

-- KHÔNG khai báo security definer: cần current_user là role đang thực thi câu lệnh
create or replace function public.companies_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified_tier := 'none';
    new.trust_score   := 0;
    new.deleted_at    := null;
    if new.status = 'suspended' then new.status := 'draft'; end if;
    return new;
  end if;

  if new.verified_tier is distinct from old.verified_tier
     or new.trust_score is distinct from old.trust_score
     or new.owner_id    is distinct from old.owner_id
     or new.deleted_at  is distinct from old.deleted_at
     or (new.status is distinct from old.status and 'suspended' in (new.status, old.status)) then
    raise exception 'Trường này do hệ thống quản lý, không thể tự thay đổi' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists t_companies_guard on public.companies;
create trigger t_companies_guard before insert or update on public.companies
  for each row execute function public.companies_guard();
