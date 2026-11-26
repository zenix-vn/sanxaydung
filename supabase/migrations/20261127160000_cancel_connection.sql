-- =============================================================
-- Bên gửi rút lại yêu cầu kết nối đang chờ (nút "Hủy yêu cầu" trên hồ sơ doanh nghiệp)
-- =============================================================
create or replace function public.cancel_connection(_connection uuid, _as_company uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_company_member(_as_company, 'editor') then
    raise exception 'Không có quyền đại diện công ty' using errcode = '42501';
  end if;
  update connections set status = 'cancelled'
   where id = _connection and requester_company_id = _as_company and status = 'pending';
  if not found then
    raise exception 'Không có yêu cầu kết nối đang chờ để hủy' using errcode = 'P0002';
  end if;
end $$;
revoke execute on function public.cancel_connection(uuid, uuid) from public, anon;
grant  execute on function public.cancel_connection(uuid, uuid) to authenticated;
