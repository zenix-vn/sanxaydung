-- =============================================================
-- 20260716090500_cron.sql
-- Tác vụ nền (pg_cron). Bọc defensive để không hard-fail nếu extension chưa bật.
-- =============================================================

do $$
begin
  -- Bật pg_cron nếu môi trường hỗ trợ (Supabase có sẵn); bỏ qua nếu không
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron không khả dụng — bỏ qua lịch chạy nền';
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then

    -- Tính lại Trust Score toàn hệ thống mỗi 03:00
    if exists (select 1 from cron.job where jobname='nightly-trust') then
      perform cron.unschedule('nightly-trust');
    end if;
    perform cron.schedule('nightly-trust', '0 3 * * *',
      $job$ select public.compute_trust_score(id) from public.companies where deleted_at is null; $job$);

    -- Hết hạn tin đăng quá deadline (mỗi giờ)
    if exists (select 1 from cron.job where jobname='expire-listings') then
      perform cron.unschedule('expire-listings');
    end if;
    perform cron.schedule('expire-listings', '10 * * * *',
      $job$ update public.marketplace_listings set status='expired'
            where status='open' and deadline is not null and deadline < now(); $job$);

  end if;
end $$;
