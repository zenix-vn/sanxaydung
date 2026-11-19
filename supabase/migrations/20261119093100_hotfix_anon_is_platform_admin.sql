-- =============================================================
-- 20261119093100_hotfix_anon_is_platform_admin.sql
-- SỰ CỐ: admin_console thêm policy SELECT (roles = public) gọi is_platform_admin() trên
-- companies/projects/reviews/posts/marketplace_listings... nhưng thu hồi EXECUTE của anon.
-- Postgres OR các policy nhưng vẫn phải chạy hàm → người chưa đăng nhập nhận
-- "permission denied for function is_platform_admin" → toàn bộ trang công khai trống.
-- An toàn: với anon, auth.uid() = null → hàm luôn trả false.
-- =============================================================
do $$
begin
  if to_regprocedure('public.is_platform_admin()') is not null then
    grant execute on function public.is_platform_admin() to anon;
  end if;
end $$;
