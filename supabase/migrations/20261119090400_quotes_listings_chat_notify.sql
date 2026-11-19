-- =============================================================
-- 20261119090400_quotes_listings_chat_notify.sql
-- Theo yêu cầu của AI-3 (mục "Giao tiếp" trong docs/phan-cong-cong-viec.md)
--   1. set_quote_status: chủ tin shortlist / chọn / từ chối báo giá
--   2. marketplace_listings: thêm location_text, start_date, view_count
--   3. Thông báo tin nhắn mới (gộp: tối đa 1 thông báo chưa đọc / hội thoại)
--   4. Thông báo review trỏ thẳng tới mục đánh giá (#danhgia)
-- =============================================================

-- ---------- 2. Cột còn thiếu của marketplace_listings ----------
alter table public.marketplace_listings
  add column if not exists location_text text,
  add column if not exists start_date    date,
  add column if not exists view_count    int not null default 0;

-- ---------- 1. set_quote_status ----------
-- RLS quotes_write chỉ cho bên báo giá UPDATE; chủ tin phải đi qua RPC này.
create or replace function public.set_quote_status(_quote uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  q quotes%rowtype;
  l marketplace_listings%rowtype;
begin
  if _status not in ('shortlisted', 'accepted', 'rejected') then
    raise exception 'Trạng thái không hợp lệ: %', _status using errcode = '22023';
  end if;

  select * into q from quotes where id = _quote for update;
  if not found then
    raise exception 'Không tìm thấy báo giá' using errcode = 'P0002';
  end if;
  select * into l from marketplace_listings where id = q.listing_id;

  if not is_company_member(l.company_id, 'editor') then
    raise exception 'Chỉ chủ tin đăng được xử lý báo giá' using errcode = '42501';
  end if;
  if q.status = 'withdrawn' then
    raise exception 'Báo giá đã được rút lại' using errcode = '22023';
  end if;

  update quotes set status = _status where id = _quote;

  perform notify_company(q.company_id, 'quote_status',
    case _status
      when 'shortlisted' then 'Báo giá của bạn được chọn vào danh sách rút gọn'
      when 'accepted'    then 'Báo giá của bạn được chấp nhận'
      else                    'Báo giá của bạn không được chọn'
    end,
    'Tin đăng: ' || l.title,
    '/marketplace/' || l.id,
    jsonb_build_object('listing_id', l.id, 'quote_id', q.id, 'status', _status));
end $$;

revoke execute on function public.set_quote_status(uuid, text) from public, anon;
grant  execute on function public.set_quote_status(uuid, text) to authenticated;

-- ---------- 3. Thông báo tin nhắn mới ----------
-- Gộp theo hội thoại để không spam: chỉ tạo khi công ty nhận chưa có thông báo
-- new_message chưa đọc nào cho hội thoại này.
create or replace function public.trg_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_from text;
  r record;
begin
  if new.kind = 'system' then
    return null;
  end if;
  select name into v_from from companies where id = new.sender_company_id;

  for r in
    select p.company_id
      from conversation_participants p
     where p.conversation_id = new.conversation_id
       and p.company_id is distinct from new.sender_company_id
  loop
    if not exists (
         select 1 from notifications n
          where n.company_id = r.company_id
            and n.type = 'new_message'
            and n.is_read = false
            and n.data->>'conversation_id' = new.conversation_id::text) then
      perform notify_company(r.company_id, 'new_message',
        'Tin nhắn mới từ ' || coalesce(v_from, 'đối tác'),
        left(coalesce(new.body, 'Đã gửi một tệp đính kèm'), 120),
        '/chat?c=' || new.conversation_id,
        jsonb_build_object('conversation_id', new.conversation_id));
    end if;
  end loop;
  return null;
end $$;

drop trigger if exists t_notify_message on public.messages;
create trigger t_notify_message
  after insert on public.messages
  for each row execute function public.trg_notify_message();

-- ---------- 4. Review → link tới mục đánh giá ----------
create or replace function public.trg_notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slug text;
begin
  select slug into v_slug from companies where id = new.target_company_id;
  perform notify_company(new.target_company_id, 'new_review',
    'Bạn nhận được đánh giá mới', 'Điểm trung bình: ' || coalesce(new.overall::text, '-'),
    '/cong-ty/' || v_slug || '#danhgia',
    jsonb_build_object('review_id', new.id));
  return null;
end $$;
