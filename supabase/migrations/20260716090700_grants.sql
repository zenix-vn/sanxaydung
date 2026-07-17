-- =============================================================
-- 20260716090700_grants.sql
-- Cấp quyền cho role Supabase (anon/authenticated/service_role).
-- RLS vẫn lọc DÒNG; GRANT mở quyền ở tầng BẢNG (PostgREST cần cả hai).
-- =============================================================

grant usage on schema public to anon, authenticated, service_role;

-- anon: chỉ đọc (RLS quyết định dòng nào)
grant select on all tables in schema public to anon;

-- authenticated: đọc + ghi (RLS chặn dòng không thuộc quyền)
grant select, insert, update, delete on all tables in schema public to authenticated;

-- service_role: toàn quyền (bỏ qua RLS)
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Mặc định cho các đối tượng tạo về sau
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
