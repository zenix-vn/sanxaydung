-- =============================================================
-- Lưu / theo dõi doanh nghiệp & tin đăng (/dashboard/saved, nút "Lưu")
-- Dữ liệu cá nhân của từng người dùng (không theo công ty).
-- =============================================================
create table if not exists public.saved_items (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('company', 'listing')),
  item_id    uuid not null,
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
create index if not exists saved_items_user_idx on public.saved_items (user_id, created_at desc);

alter table public.saved_items enable row level security;
drop policy if exists saved_own on public.saved_items;
create policy saved_own on public.saved_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.saved_items from anon;
grant select, insert, update, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;

-- Giới hạn 500 mục / người để tránh lạm dụng
create or replace function public.saved_items_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from saved_items where user_id = new.user_id) >= 500 then
    raise exception 'Đã đạt giới hạn 500 mục đã lưu' using errcode = '54000';
  end if;
  return new;
end $$;
drop trigger if exists t_saved_items_limit on public.saved_items;
create trigger t_saved_items_limit before insert on public.saved_items
  for each row execute function public.saved_items_limit();
