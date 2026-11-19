-- =============================================================
-- 20261119090900_backfill_owner_members.sql
-- Luồng tạo công ty cũ (trước RPC create_company) chèn companies.owner_id nhưng không ghi được
-- company_members → chủ sở hữu không thấy công ty trong bảng điều khiển.
-- Bổ sung dòng thành viên 'owner' còn thiếu. Idempotent.
-- =============================================================
insert into public.company_members(company_id, user_id, role, status)
  select c.id, c.owner_id, 'owner', 'active'
    from public.companies c
   where c.owner_id is not null
     and c.deleted_at is null
     and not exists (select 1 from public.company_members m
                      where m.company_id = c.id and m.user_id = c.owner_id)
on conflict (company_id, user_id) do nothing;
