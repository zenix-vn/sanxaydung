-- =============================================================
-- 20261119090500_fix_chat_rls_recursion.sql
-- Policy cp_read trên conversation_participants tự truy vấn chính bảng đó
-- → "infinite recursion detected in policy" cho MỌI người dùng thường khi đọc
-- conversations / messages / conversation_participants (chat hỏng hoàn toàn).
-- Phá vòng lặp bằng hàm security definer (bỏ qua RLS khi tra participants).
-- =============================================================

create or replace function public.in_conversation(_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants p
     where p.conversation_id = _conversation
       and public.is_company_member(p.company_id)
  );
$$;
revoke execute on function public.in_conversation(uuid) from public, anon;
grant  execute on function public.in_conversation(uuid) to authenticated;

drop policy if exists cp_read  on public.conversation_participants;
drop policy if exists conv_read on public.conversations;
drop policy if exists msg_read  on public.messages;

create policy cp_read on public.conversation_participants for select using (
  public.is_company_member(company_id) or public.in_conversation(conversation_id)
);
create policy conv_read on public.conversations for select using (
  public.in_conversation(id)
);
create policy msg_read on public.messages for select using (
  public.in_conversation(conversation_id)
);
