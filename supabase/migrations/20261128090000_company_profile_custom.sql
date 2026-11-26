-- =============================================================
-- 20261128090000_company_profile_custom.sql
-- Tùy biến trang hồ sơ doanh nghiệp (đợt 1):
--   - companies.profile_settings: màu thương hiệu, khẩu hiệu, điểm lấy nét ảnh bìa,
--     số liệu nổi bật, liên kết mạng xã hội. Web tự làm sạch giá trị khi đọc (lib/profile.ts)
--     vì thành viên có thể ghi thẳng qua API.
--   - Cho khách tải tài liệu "Công khai" và đối tác đã kết nối tải tài liệu "connections".
-- =============================================================

alter table public.companies
  add column if not exists profile_settings jsonb not null default '{}'::jsonb;

alter table public.companies drop constraint if exists companies_profile_settings_check;
alter table public.companies add constraint companies_profile_settings_check
  check (jsonb_typeof(profile_settings) = 'object' and octet_length(profile_settings::text) <= 8000);

-- Thư viện ảnh/video chung của công ty: media owner_type='company', owner_id = company_id
create index if not exists media_company_idx on public.media (company_id, owner_type, sort_order);

-- Tài liệu "Công khai" chỉ công khai khi hồ sơ đã xuất bản (trước đây hồ sơ nháp/bị khóa vẫn lộ)
drop policy if exists docs_read on public.documents;
create policy docs_read on public.documents for select using (
  is_company_member(company_id)
  or (
    exists (select 1 from public.companies c
             where c.id = documents.company_id and c.status = 'published' and c.deleted_at is null)
    and (
      visibility = 'public'
      or (visibility = 'connections' and exists (
            select 1 from public.company_members vm
            join public.connections cn on cn.status = 'completed'
              and ((cn.requester_company_id = documents.company_id and cn.target_company_id = vm.company_id)
                or (cn.target_company_id = documents.company_id and cn.requester_company_id = vm.company_id))
            where vm.user_id = auth.uid() and vm.status = 'active'))
    )
  )
);

-- Đọc file trong bucket riêng tư (để tạo signed URL) khi người dùng nhìn thấy dòng documents
-- tương ứng (RLS docs_read áp dụng trong subquery). BẮT BUỘC file nằm đúng thư mục của công ty
-- sở hữu dòng đó, nếu không biên tập viên công ty A có thể trỏ file_url sang file của công ty B.
drop policy if exists "documents read shared" on storage.objects;
create policy "documents read shared" on storage.objects for select
  using (
    bucket_id = 'company-documents'
    and exists (
      select 1 from public.documents d
       where d.file_url = objects.name
         and d.company_id::text = (storage.foldername(objects.name))[1]
    )
  );

create index if not exists documents_file_url_idx on public.documents (file_url);
