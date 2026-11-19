-- =============================================================
-- 20261119090100_storage_hardening.sql
-- AI-1 · task #6: siết Storage
--   - Giới hạn dung lượng + loại file cho từng bucket
--   - Bucket avatars (path: {user_id}/...)
--   - Đọc file đính kèm chat cho CẢ HAI bên của hội thoại
--   - Verification docs: admin được xoá/ghi đè file của công ty mình
--
-- QUY ƯỚC PATH (web phải tuân theo, policy dựa vào folder đầu tiên):
--   company-logos        {company_id}/logo.{ext}  |  {company_id}/cover.{ext}
--   company-gallery      {company_id}/{project_id}/{file}
--   post-media           {company_id}/{post_id}/{file}
--   company-documents    {company_id}/{file}
--   verification-docs    {company_id}/{kind}/{file}
--   message-attachments  {company_id}/{conversation_id}/{file}
--   avatars              {user_id}/avatar.{ext}
-- =============================================================

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ---------- Giới hạn dung lượng + MIME ----------
update storage.buckets set
  file_size_limit    = 5 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
where id in ('company-logos', 'company-gallery', 'post-media', 'avatars');

update storage.buckets set
  file_size_limit    = 20 * 1024 * 1024,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id in ('company-documents', 'message-attachments');

update storage.buckets set
  file_size_limit    = 10 * 1024 * 1024,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
where id = 'verification-docs';

-- ---------- avatars: chỉ chủ tài khoản ghi vào folder của mình ----------
drop policy if exists "avatars read"   on storage.objects;
drop policy if exists "avatars write"  on storage.objects;
drop policy if exists "avatars update" on storage.objects;
drop policy if exists "avatars delete" on storage.objects;

create policy "avatars read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- verification-docs: admin xoá / ghi đè (nộp lại hồ sơ) ----------
drop policy if exists "verification update by admin" on storage.objects;
drop policy if exists "verification delete by admin" on storage.objects;

create policy "verification update by admin" on storage.objects for update to authenticated
  using (bucket_id = 'verification-docs'
         and public.is_company_member((storage.foldername(name))[1]::uuid, 'admin'));
create policy "verification delete by admin" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs'
         and public.is_company_member((storage.foldername(name))[1]::uuid, 'admin'));

-- ---------- message-attachments ----------
-- Trước đây chỉ có INSERT và không có SELECT → không ai đọc được file.
-- Giờ: ghi vào {company_id}/{conversation_id}/... khi công ty đó là participant;
-- đọc bởi mọi thành viên của các công ty tham gia hội thoại.
drop policy if exists "attachments write by member" on storage.objects;
drop policy if exists "attachments read by participant" on storage.objects;
drop policy if exists "attachments delete by sender" on storage.objects;

create policy "attachments write by member" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
    and exists (select 1 from public.conversation_participants p
                 where p.conversation_id = (storage.foldername(name))[2]::uuid
                   and p.company_id      = (storage.foldername(name))[1]::uuid)
  );

create policy "attachments read by participant" on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and exists (select 1 from public.conversation_participants p
                 where p.conversation_id = (storage.foldername(name))[2]::uuid
                   and public.is_company_member(p.company_id))
  );

create policy "attachments delete by sender" on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid, 'editor')
  );
