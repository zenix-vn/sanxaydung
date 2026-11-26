-- =============================================================
-- Bình luận bài viết News Feed (/feed/[id])
-- Bình luận nhân danh một doanh nghiệp mà người viết là thành viên.
-- posts.comment_count do trigger (security definer) cập nhật.
-- =============================================================
create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 1 and 2000),
  status      text not null default 'published' check (status in ('published', 'hidden')),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists pc_read on public.post_comments;
create policy pc_read on public.post_comments for select using (
  (status = 'published' and deleted_at is null
    and exists (select 1 from posts p where p.id = post_id and p.status = 'published' and p.deleted_at is null))
  or author_id = auth.uid()
  or public.has_platform_role('moderator'));

drop policy if exists pc_insert on public.post_comments;
create policy pc_insert on public.post_comments for insert with check (
  author_id = auth.uid()
  and status = 'published' and deleted_at is null
  and public.is_company_member(company_id)
  and exists (select 1 from posts p where p.id = post_id and p.status = 'published' and p.deleted_at is null));

-- Sửa/xóa mềm: người viết; chủ bài (admin công ty đăng bài) được ẩn bình luận trên bài của mình
drop policy if exists pc_update on public.post_comments;
create policy pc_update on public.post_comments for update using (
  author_id = auth.uid()
  or exists (select 1 from posts p where p.id = post_id and public.is_company_member(p.company_id, 'admin')))
  with check (true);

revoke all on public.post_comments from anon;
grant select on public.post_comments to anon;
grant select, insert, update on public.post_comments to authenticated;
grant all on public.post_comments to service_role;

-- Người viết chỉ được sửa nội dung / xóa mềm; không đổi bài, công ty, tác giả
create or replace function public.post_comments_guard()
returns trigger language plpgsql as $$
begin
  if new.post_id <> old.post_id or new.company_id <> old.company_id or new.author_id <> old.author_id
     or new.created_at <> old.created_at then
    raise exception 'Không được thay đổi thông tin gốc của bình luận' using errcode = '42501';
  end if;
  -- chủ bài chỉ được ẩn/xóa, không được sửa lời của người khác
  if new.body <> old.body and old.author_id is distinct from auth.uid() then
    raise exception 'Chỉ người viết được sửa nội dung bình luận' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists t_post_comments_guard on public.post_comments;
create trigger t_post_comments_guard before update on public.post_comments
  for each row execute function public.post_comments_guard();

create or replace function public.bump_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update posts set comment_count = (
    select count(*) from post_comments
     where post_id = v_post and status = 'published' and deleted_at is null)
   where id = v_post;
  return null;
end $$;
drop trigger if exists t_post_comments_count on public.post_comments;
create trigger t_post_comments_count after insert or update or delete on public.post_comments
  for each row execute function public.bump_comment_count();

-- Thông báo cho admin công ty đăng bài (không báo khi tự bình luận bài mình)
create or replace function public.trg_notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare p posts; v_name text;
begin
  select * into p from posts where id = new.post_id;
  if p.company_id = new.company_id then return null; end if;
  select name into v_name from companies where id = new.company_id;
  perform notify_company(p.company_id, 'post_comment', 'Bình luận mới',
    format('%s đã bình luận bài viết của bạn.', v_name), '/feed/' || p.id || '#comments');
  return null;
end $$;
drop trigger if exists t_post_comments_notify on public.post_comments;
create trigger t_post_comments_notify after insert on public.post_comments
  for each row execute function public.trg_notify_comment();
