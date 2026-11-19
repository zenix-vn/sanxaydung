-- =============================================================
-- 20261119090200_webhooks_cron_sitemap.sql
-- AI-1 · task #4, #5
--   1. dispatch_edge(): gọi Edge Function qua pg_net — KHÔNG làm hỏng giao dịch
--      khi thiếu pg_net / chưa cấu hình (môi trường tối giản không có Edge runtime)
--   2. Webhook: notifications → notify-dispatch, company_verifications → verify-company
--   3. subscriptions.provider_ref (idempotency cho payment-webhook)
--   4. RPC sitemap_entries() cho web (app/sitemap.ts)
--   5. pg_cron: dọn thông báo cũ
--
-- Cấu hình (chạy 1 lần trên mỗi môi trường, KHÔNG commit giá trị thật):
--   alter database postgres set app.edge_function_url = 'https://<ref>.supabase.co/functions/v1';
--   alter database postgres set app.service_role_key  = '<service_role_key>';
-- Chưa đặt → dispatch_edge là no-op (thông báo vẫn ghi vào bảng và đẩy Realtime).
-- =============================================================

-- ---------- 1. dispatch_edge ----------
create or replace function public.dispatch_edge(_fn text, _payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text := nullif(current_setting('app.edge_function_url', true), '');
  v_key text := nullif(current_setting('app.service_role_key', true), '');
begin
  if v_url is null or v_key is null then
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  perform net.http_post(
    url     := v_url || '/' || _fn,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := _payload
  );
exception when others then
  -- Webhook là "best effort": lỗi mạng/cấu hình không được chặn INSERT gốc
  raise warning 'dispatch_edge(%) lỗi: %', _fn, sqlerrm;
end $$;
revoke execute on function public.dispatch_edge(text, jsonb) from public, anon, authenticated;

-- ---------- 2. Webhook triggers ----------
create or replace function public.trg_webhook_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_edge('notify-dispatch',
    jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new)));
  return null;
end $$;

drop trigger if exists t_webhook_notification on public.notifications;
create trigger t_webhook_notification
  after insert on public.notifications
  for each row execute function public.trg_webhook_notification();

create or replace function public.trg_webhook_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_edge('verify-company',
    jsonb_build_object('verification_id', new.id));
  return null;
end $$;

drop trigger if exists t_webhook_verification on public.company_verifications;
create trigger t_webhook_verification
  after insert on public.company_verifications
  for each row when (new.status = 'pending')
  execute function public.trg_webhook_verification();

-- ---------- 3. Idempotency cho payment-webhook ----------
alter table public.subscriptions add column if not exists provider_ref text;
create unique index if not exists subscriptions_provider_ref_uq
  on public.subscriptions (provider_ref) where provider_ref is not null;

-- ---------- 4. Sitemap ----------
-- Công khai (anon) — chỉ trả slug/id + thời gian cập nhật của nội dung đã publish.
create or replace function public.sitemap_entries()
returns table (kind text, path text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'company'::text, '/cong-ty/' || c.slug, coalesce(c.updated_at, c.created_at)
    from companies c
   where c.status = 'published' and c.deleted_at is null
  union all
  select 'listing'::text, '/marketplace/' || l.id::text, coalesce(l.updated_at, l.created_at)
    from marketplace_listings l
   where l.status = 'open' and l.deleted_at is null
$$;
grant execute on function public.sitemap_entries() to anon, authenticated, service_role;

-- ---------- 5. pg_cron: dọn thông báo đã đọc > 90 ngày ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-notifications') then
      perform cron.unschedule('purge-notifications');
    end if;
    perform cron.schedule('purge-notifications', '30 3 * * 0',
      $job$ delete from public.notifications
            where is_read and created_at < now() - interval '90 days'; $job$);
  end if;
end $$;
