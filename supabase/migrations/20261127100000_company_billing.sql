-- =============================================================
-- Doanh nghiệp tự xem gói hiện tại & lịch sử thanh toán (/dashboard/billing)
-- payments chỉ admin sàn đọc trực tiếp (có ghi chú nội bộ) → RPC trả cột an toàn,
-- chỉ cho chủ sở hữu/quản trị của chính công ty.
-- =============================================================
create or replace function public.my_billing(_company uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_company_member(_company, 'admin') then
    raise exception 'Chỉ chủ sở hữu/quản trị xem được thanh toán' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'subscription', (
      select jsonb_build_object('plan_id', s.plan_id, 'plan_name', p.name, 'status', s.status,
                                'started_at', s.started_at, 'expires_at', s.expires_at, 'price_month', p.price_month)
        from subscriptions s left join plans p on p.id = s.plan_id
       where s.company_id = _company and s.status in ('active', 'past_due')
       order by s.expires_at desc nulls first limit 1),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'plan_name', p.name, 'months', x.months, 'amount', x.amount,
                                          'method', x.method, 'invoice_no', x.invoice_no, 'paid_at', x.paid_at,
                                          'voided', x.voided_at is not null) order by x.paid_at desc, x.created_at desc)
        from (select * from payments where company_id = _company order by paid_at desc limit 50) x
        left join plans p on p.id = x.plan_id), '[]'::jsonb));
end $$;
revoke execute on function public.my_billing(uuid) from public, anon;
grant  execute on function public.my_billing(uuid) to authenticated;
