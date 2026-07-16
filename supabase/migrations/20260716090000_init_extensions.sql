-- =============================================================
-- 20260716090000_init_extensions.sql
-- Extensions, cấu hình Full-Text Search tiếng Việt, helper chung
-- =============================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;        -- fuzzy search
create extension if not exists unaccent;       -- bỏ dấu tiếng Việt

-- Cấu hình FTS tiếng Việt: bỏ dấu + không stemming tiếng Anh
drop text search configuration if exists public.vn;
create text search configuration public.vn ( copy = simple );
alter text search configuration public.vn
  alter mapping for hword, hword_part, word with unaccent, simple;

-- Trigger cập nhật updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Tự tạo profiles khi có user mới trong auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.phone)
  on conflict (id) do nothing;
  return new;
end $$;
