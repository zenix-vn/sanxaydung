-- pgTAP — kiểm thử RPC nghiệp vụ & RLS (AI-1 task #7)
-- Chạy: supabase test db        (cần Docker + pgTAP, có sẵn trong stack local)
begin;
select plan(27);

-- ---------- Fixtures (chạy bằng quyền postgres) ----------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.vn',     now()),   -- chủ công ty A
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.vn',     now()),   -- chủ công ty B
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.vn',     now()),   -- chủ công ty C (người ngoài)
  ('00000000-0000-0000-0000-0000000000d1', 'claim@test.vn', now()),   -- email trùng công ty D
  ('00000000-0000-0000-0000-0000000000e1', 'other@test.vn', now());   -- không liên quan

insert into public.companies (id, slug, name, status, email) values
  ('10000000-0000-0000-0000-00000000000a', 'cty-a', 'Cty A', 'published', null),
  ('10000000-0000-0000-0000-00000000000b', 'cty-b', 'Cty B', 'published', null),
  ('10000000-0000-0000-0000-00000000000c', 'cty-c', 'Cty C', 'published', null),
  ('10000000-0000-0000-0000-00000000000d', 'cty-d', 'Cty D', 'published', 'claim@test.vn');

insert into public.company_members (company_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000c1', 'owner');

insert into public.connections (id, requester_company_id, target_company_id, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', 'completed'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', 'pending');

insert into public.posts (id, company_id, body) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b', 'bài của B');

insert into public.marketplace_listings (id, company_id, type, title) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b', 'need_contractor', 'Tin của B');
insert into public.quotes (id, listing_id, company_id, amount) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000c', 1000);

-- ---------- Quyền gọi hàm nội bộ ----------
select ok(not has_function_privilege('anon', 'public.compute_trust_score(uuid)', 'execute'),
  'anon không gọi được compute_trust_score');
select ok(not has_function_privilege('authenticated', 'public.promote_registration(uuid)', 'execute'),
  'authenticated không gọi được promote_registration');
select ok(not has_function_privilege('anon', 'public.toggle_like(uuid)', 'execute'),
  'anon không gọi được toggle_like');

-- ---------- Công ty A (user a1) ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select throws_ok(
  $$select public.create_connection('10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a')$$,
  '22023', null, 'không tự kết nối với chính mình');

select throws_ok(
  $$select public.create_connection('10000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000c')$$,
  '42501', null, 'không đại diện công ty không thuộc mình');

select is(
  public.create_connection('10000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000a'),
  '20000000-0000-0000-0000-000000000002'::uuid,
  'tạo kết nối trùng → trả lại kết nối đang mở, không tạo mới');

select throws_ok(
  $$select public.complete_connection('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-00000000000a')$$,
  'P0002', null, 'chỉ hoàn tất khi đã accepted');

-- Review: đúng đối tác thì được, sai đối tác bị chặn
select throws_ok(
  $$select public.submit_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000c',5,5,5,5,5,5,'x')$$,
  '42501', null, 'không review công ty C bằng kết nối A–B');
select lives_ok(
  $$select public.submit_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b',5,4,5,5,5,4,'tốt')$$,
  'review đúng đối tác của kết nối đã hoàn tất');
select throws_ok(
  $$select public.submit_review('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b',5,5,5,5,5,5,'lần 2')$$,
  '23505', null, 'mỗi kết nối chỉ review một lần');

-- Like bởi người không phải chủ bài (RLS posts chặn UPDATE → trước đây like_count không tăng)
select is(public.toggle_like('30000000-0000-0000-0000-000000000001'), true, 'toggle_like lần 1 = đã thích');
select is((select like_count from public.posts where id = '30000000-0000-0000-0000-000000000001'), 1,
  'like_count tăng dù người thích không phải chủ bài');
select is(public.toggle_like('30000000-0000-0000-0000-000000000001'), false, 'toggle_like lần 2 = bỏ thích');

-- Chat: mở hội thoại idempotent
select is(
  public.start_conversation('10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b'),
  public.start_conversation('10000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000b'),
  'start_conversation trả cùng 1 hội thoại');

-- Sau khi sửa vòng lặp RLS: người tham gia đọc được hội thoại và gửi tin
select is((select count(*)::int from public.conversations), 1, 'A thấy hội thoại của mình (RLS không đệ quy)');
select lives_ok(
  $$insert into public.messages(conversation_id, sender_company_id, sender_user_id, body)
    select id, '10000000-0000-0000-0000-00000000000a', auth.uid(), 'xin chào' from public.conversations limit 1$$,
  'A gửi tin nhắn 1');
select lives_ok(
  $$insert into public.messages(conversation_id, sender_company_id, sender_user_id, body)
    select id, '10000000-0000-0000-0000-00000000000a', auth.uid(), 'tin thứ hai' from public.conversations limit 1$$,
  'A gửi tin nhắn 2');

-- ---------- Báo giá: chỉ chủ tin (B) được đổi trạng thái ----------
select throws_ok(
  $$select public.set_quote_status('50000000-0000-0000-0000-000000000001','accepted')$$,
  '42501', null, 'công ty A (không phải chủ tin) không đổi được trạng thái báo giá');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_quote_status('50000000-0000-0000-0000-000000000001','shortlisted')$$,
  'chủ tin B shortlist được báo giá');

-- B nhận 1 thông báo gộp cho 2 tin nhắn, và thấy 2 tin chưa đọc
select is((select count(*)::int from public.notifications where type = 'new_message'), 1,
  '2 tin nhắn cùng hội thoại → 1 thông báo (gộp)');
select is((select unread_count::int from public.list_conversations('10000000-0000-0000-0000-00000000000b')), 2,
  'list_conversations: B có 2 tin chưa đọc');

-- ---------- Người ngoài (user c1) không đọc được hội thoại A–B ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.conversations), 0, 'công ty C không thấy hội thoại của A–B');

-- ---------- Claim công ty ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is(public.claim_company('10000000-0000-0000-0000-00000000000d'), 'pending',
  'email không trùng → chờ admin duyệt');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is(public.claim_company('10000000-0000-0000-0000-00000000000d'), 'claimed',
  'email đã xác thực trùng email công ty → claim ngay');
select throws_ok(
  $$select public.claim_company('10000000-0000-0000-0000-00000000000d')$$,
  '23505', null, 'công ty đã có chủ thì không claim được nữa');

-- ---------- Xoá tài khoản khoá đăng nhập ----------
select lives_ok($$select public.delete_my_account()$$, 'delete_my_account chạy được');
reset role;
select ok((select banned_until > now() from auth.users where id = '00000000-0000-0000-0000-0000000000d1'),
  'delete_my_account cấm đăng nhập lại');

select * from finish();
rollback;
