-- =============================================================
-- 20260716090300_rls_policies.sql
-- Bật RLS trên mọi bảng + policy. Mặc định từ chối, cấp quyền tường minh.
-- =============================================================

-- Bật RLS
alter table public.profiles              enable row level security;
alter table public.companies             enable row level security;
alter table public.company_members       enable row level security;
alter table public.company_invitations   enable row level security;
alter table public.company_verifications enable row level security;
alter table public.categories            enable row level security;
alter table public.company_categories    enable row level security;
alter table public.provinces             enable row level security;
alter table public.company_locations     enable row level security;
alter table public.projects              enable row level security;
alter table public.media                 enable row level security;
alter table public.documents             enable row level security;
alter table public.services              enable row level security;
alter table public.equipment             enable row level security;
alter table public.staff                 enable row level security;
alter table public.posts                 enable row level security;
alter table public.post_reactions        enable row level security;
alter table public.marketplace_listings  enable row level security;
alter table public.quotes                enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages              enable row level security;
alter table public.connections           enable row level security;
alter table public.reviews               enable row level security;
alter table public.trust_scores          enable row level security;
alter table public.trust_score_history   enable row level security;
alter table public.notifications         enable row level security;
alter table public.notification_prefs    enable row level security;
alter table public.plans                 enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.ad_placements         enable row level security;
alter table public.audit_log             enable row level security;
alter table public.reports               enable row level security;

-- ---------- Dữ liệu tham chiếu công khai ----------
create policy provinces_read  on public.provinces  for select using (true);
create policy categories_read on public.categories for select using (true);
create policy plans_read      on public.plans      for select using (true);

-- ---------- profiles ----------
create policy profiles_read       on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- companies ----------
create policy companies_read on public.companies for select
  using ((status='published' and deleted_at is null) or is_company_member(id));
create policy companies_insert on public.companies for insert
  with check (owner_id = auth.uid());
create policy companies_update on public.companies for update
  using (is_company_member(id,'editor')) with check (is_company_member(id,'editor'));
create policy companies_delete on public.companies for delete
  using (is_company_member(id,'owner'));

-- ---------- company_members ----------
create policy cm_read  on public.company_members for select using (is_company_member(company_id));
create policy cm_write on public.company_members for all
  using (is_company_member(company_id,'admin')) with check (is_company_member(company_id,'admin'));
-- Cho phép owner tự thêm bản ghi owner đầu tiên khi tạo công ty
create policy cm_bootstrap_owner on public.company_members for insert
  with check (user_id = auth.uid() and role='owner'
              and exists (select 1 from public.companies c where c.id=company_id and c.owner_id=auth.uid()));

-- ---------- company_invitations ----------
create policy ci_manage on public.company_invitations for all
  using (is_company_member(company_id,'admin')) with check (is_company_member(company_id,'admin'));

-- ---------- company_verifications ----------
create policy cv_read  on public.company_verifications for select
  using (status='verified' or is_company_member(company_id));
-- Ghi qua RPC request_verification (security definer) — không mở insert trực tiếp cho client.

-- ---------- taxonomy joins ----------
create policy ccat_read  on public.company_categories for select using (true);
create policy ccat_write on public.company_categories for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));
create policy cloc_read  on public.company_locations for select using (true);
create policy cloc_write on public.company_locations for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

-- ---------- portfolio (mẫu chung: đọc công khai nếu company published; ghi bởi editor+) ----------
create policy projects_read  on public.projects for select
  using (is_company_member(company_id) or exists (select 1 from companies c where c.id=company_id and c.status='published'));
create policy projects_write on public.projects for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

create policy media_read  on public.media for select
  using (is_company_member(company_id) or exists (select 1 from companies c where c.id=company_id and c.status='published'));
create policy media_write on public.media for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

create policy services_read  on public.services for select
  using (is_company_member(company_id) or exists (select 1 from companies c where c.id=company_id and c.status='published'));
create policy services_write on public.services for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

create policy equipment_read  on public.equipment for select
  using (is_company_member(company_id) or exists (select 1 from companies c where c.id=company_id and c.status='published'));
create policy equipment_write on public.equipment for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

create policy staff_read  on public.staff for select
  using (is_company_member(company_id) or exists (select 1 from companies c where c.id=company_id and c.status='published'));
create policy staff_write on public.staff for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

-- ---------- documents (theo visibility, kể cả 'connections') ----------
create policy docs_read on public.documents for select using (
  visibility='public'
  or is_company_member(company_id)
  or (visibility='connections' and exists (
        select 1 from public.company_members vm
        join public.connections cn on cn.status='completed'
          and ((cn.requester_company_id=documents.company_id and cn.target_company_id=vm.company_id)
            or (cn.target_company_id=documents.company_id and cn.requester_company_id=vm.company_id))
        where vm.user_id=auth.uid() and vm.status='active'))
);
create policy docs_write on public.documents for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

-- ---------- posts ----------
create policy posts_read on public.posts for select
  using ((status='published' and deleted_at is null) or is_company_member(company_id));
create policy posts_write on public.posts for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

create policy reactions_read  on public.post_reactions for select using (true);
create policy reactions_write on public.post_reactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- marketplace ----------
create policy listings_read on public.marketplace_listings for select
  using ((status='open' and deleted_at is null) or is_company_member(company_id));
create policy listings_write on public.marketplace_listings for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

-- quotes: chủ tin xem tất cả báo giá; bên báo giá xem của mình
create policy quotes_read on public.quotes for select using (
  is_company_member(company_id)
  or exists (select 1 from marketplace_listings l where l.id=listing_id and is_company_member(l.company_id))
);
create policy quotes_write on public.quotes for all
  using (is_company_member(company_id,'editor')) with check (is_company_member(company_id,'editor'));

-- ---------- chat ----------
create policy conv_read on public.conversations for select using (
  exists (select 1 from conversation_participants p
          where p.conversation_id=conversations.id and is_company_member(p.company_id))
);
create policy conv_insert on public.conversations for insert with check (created_by = auth.uid());

create policy cp_read on public.conversation_participants for select using (
  is_company_member(company_id)
  or exists (select 1 from conversation_participants p2
             where p2.conversation_id=conversation_participants.conversation_id and is_company_member(p2.company_id))
);
create policy cp_write on public.conversation_participants for all
  using (is_company_member(company_id)) with check (is_company_member(company_id));

create policy msg_read on public.messages for select using (
  exists (select 1 from conversation_participants p
          where p.conversation_id=messages.conversation_id and is_company_member(p.company_id))
);
create policy msg_send on public.messages for insert with check (
  is_company_member(sender_company_id)
  and exists (select 1 from conversation_participants p
              where p.conversation_id=messages.conversation_id and p.company_id=sender_company_id)
);

-- ---------- connections ----------
create policy conn_read on public.connections for select using (
  is_company_member(requester_company_id) or is_company_member(target_company_id)
);
-- Ghi qua RPC create_connection/complete_connection.

-- ---------- reviews ----------
create policy rv_read  on public.reviews for select using (status='published' or is_company_member(reviewer_company_id) or is_company_member(target_company_id));
-- Ghi qua RPC submit_review.

-- ---------- trust score (chỉ đọc; ghi bởi service_role qua Edge Function) ----------
create policy ts_read  on public.trust_scores        for select using (true);
create policy tsh_read on public.trust_score_history for select using (true);

-- ---------- notifications ----------
create policy noti_read   on public.notifications for select using (user_id = auth.uid());
create policy noti_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Insert bởi service_role.

create policy np_all on public.notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- subscriptions / ads ----------
create policy sub_read on public.subscriptions for select using (is_company_member(company_id));
create policy ads_read on public.ad_placements for select using (status='active' or is_company_member(company_id));

-- ---------- reports ----------
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read   on public.reports for select using (reporter_id = auth.uid());

-- audit_log: không có policy cho client ⇒ chỉ service_role truy cập.
