-- =============================================================
-- 20260716090400_storage.sql
-- Storage buckets + policy (path quy ước: {company_id}/...)
-- =============================================================

insert into storage.buckets (id, name, public) values
  ('company-logos',       'company-logos',       true),
  ('company-gallery',     'company-gallery',     true),
  ('post-media',          'post-media',          true),
  ('company-documents',   'company-documents',   false),
  ('verification-docs',   'verification-docs',   false),
  ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

-- Helper: lấy company_id từ folder đầu tiên của path
-- storage.foldername(name)[1] = phần đầu path

-- ---------- Bucket công khai: đọc tự do, ghi bởi editor+ ----------
create policy "public buckets read"
  on storage.objects for select
  using (bucket_id in ('company-logos','company-gallery','post-media'));

create policy "public buckets write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('company-logos','company-gallery','post-media')
    and public.is_company_member((storage.foldername(name))[1]::uuid, 'editor')
  );

create policy "public buckets update"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('company-logos','company-gallery','post-media')
    and public.is_company_member((storage.foldername(name))[1]::uuid, 'editor')
  );

create policy "public buckets delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('company-logos','company-gallery','post-media')
    and public.is_company_member((storage.foldername(name))[1]::uuid, 'editor')
  );

-- ---------- company-documents: đọc/ghi bởi thành viên công ty ----------
create policy "documents read by member"
  on storage.objects for select to authenticated
  using (bucket_id='company-documents'
         and public.is_company_member((storage.foldername(name))[1]::uuid));

create policy "documents write by editor"
  on storage.objects for insert to authenticated
  with check (bucket_id='company-documents'
              and public.is_company_member((storage.foldername(name))[1]::uuid,'editor'));

create policy "documents delete by editor"
  on storage.objects for delete to authenticated
  using (bucket_id='company-documents'
         and public.is_company_member((storage.foldername(name))[1]::uuid,'editor'));

-- ---------- verification-docs: chỉ thành viên công ty (duyệt bởi service_role) ----------
create policy "verification read by member"
  on storage.objects for select to authenticated
  using (bucket_id='verification-docs'
         and public.is_company_member((storage.foldername(name))[1]::uuid,'admin'));

create policy "verification write by admin"
  on storage.objects for insert to authenticated
  with check (bucket_id='verification-docs'
              and public.is_company_member((storage.foldername(name))[1]::uuid,'admin'));

-- ---------- message-attachments: người gửi (thành viên công ty ở folder) ----------
create policy "attachments write by member"
  on storage.objects for insert to authenticated
  with check (bucket_id='message-attachments'
              and public.is_company_member((storage.foldername(name))[1]::uuid));
-- Đọc file riêng tư nên phục vụ qua signed URL do Edge Function cấp sau khi kiểm tra quyền hội thoại.
