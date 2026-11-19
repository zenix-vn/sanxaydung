-- =============================================================
-- 20261119090700_claim_by_registration_email.sql
-- Đăng nhập chỉ còn Google (không có SĐT đã xác thực) → cần cách khác để chủ doanh nghiệp
-- nhận hồ sơ cold-start. Dữ liệu import có "Email Address" của người điền form
-- (partner_registrations.payload.email_google). Nếu email Google ĐÃ XÁC THỰC của người dùng
-- trùng email đó → được nhận hồ sơ ngay (method='email').
--
-- Email của người điền form KHÔNG được ghi vào companies.email (bảng này đọc công khai qua API
-- → sẽ lộ email cá nhân); chỉ đối chiếu phía server trong hàm security definer.
-- =============================================================

-- Hồ sơ chưa có chủ khớp với email Google đã xác thực của người đang đăng nhập
create or replace function public.my_claimable_companies()
returns table (id uuid, name text, slug text, address text, verified_tier text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.slug, c.address, c.verified_tier
    from companies c
    join auth.users u on u.id = auth.uid()
   where c.owner_id is null
     and c.deleted_at is null
     and u.email_confirmed_at is not null
     and u.email is not null
     and ( lower(trim(coalesce(c.email, ''))) = lower(u.email)
        or exists (select 1 from partner_registrations pr
                    where pr.company_id = c.id
                      and lower(trim(coalesce(pr.payload->>'email_google', ''))) = lower(u.email)) )
   order by c.name
   limit 20;
$$;
revoke execute on function public.my_claimable_companies() from public, anon;
grant  execute on function public.my_claimable_companies() to authenticated;

-- claim_company: thêm nhánh khớp email đăng ký (giữ nguyên các nhánh SĐT / email công ty / chờ duyệt)
create or replace function public.claim_company(_company uuid, _note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  c        companies%rowtype;
  u        auth.users%rowtype;
  v_method text;
begin
  if v_uid is null then
    raise exception 'Chưa đăng nhập' using errcode = '42501';
  end if;

  select * into c from companies where id = _company and deleted_at is null;
  if not found then
    raise exception 'Không tìm thấy doanh nghiệp' using errcode = 'P0002';
  end if;
  if c.owner_id is not null
     or exists (select 1 from company_members
                 where company_id = _company and role = 'owner' and status = 'active') then
    raise exception 'Doanh nghiệp đã có chủ sở hữu' using errcode = '23505';
  end if;

  select * into u from auth.users where id = v_uid;
  if u.phone_confirmed_at is not null
     and normalize_phone(u.phone) is not null
     and normalize_phone(u.phone) = normalize_phone(c.phone) then
    v_method := 'phone';
  elsif u.email_confirmed_at is not null
     and nullif(trim(coalesce(c.email, '')), '') is not null
     and lower(u.email) = lower(trim(c.email)) then
    v_method := 'email';
  elsif u.email_confirmed_at is not null
     and u.email is not null
     and exists (select 1 from partner_registrations pr
                  where pr.company_id = _company
                    and lower(trim(coalesce(pr.payload->>'email_google', ''))) = lower(u.email)) then
    v_method := 'email';
  end if;

  if v_method is null then
    insert into company_claims(company_id, user_id, method, claimed_phone, note)
      select _company, v_uid, 'manual', p.phone, _note
        from profiles p where p.id = v_uid
    on conflict (company_id, user_id) where status = 'pending' do nothing;
    return 'pending';
  end if;

  perform public._assign_company_owner(_company, v_uid);
  insert into company_claims(company_id, user_id, method, claimed_phone, status, reviewed_at)
    values (_company, v_uid, v_method, c.phone, 'approved', now());
  insert into audit_log(actor_id, company_id, action, entity_type, entity_id, diff)
    values (v_uid, _company, 'company.claim', 'company', _company,
            jsonb_build_object('method', v_method));
  return 'claimed';
end $$;
