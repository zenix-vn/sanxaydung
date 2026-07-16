-- =============================================================
-- 20260716090100_core_tables.sql
-- Toàn bộ bảng (thứ tự theo phụ thuộc khóa ngoại)
-- =============================================================

-- ---------- Người dùng & doanh nghiệp ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  tax_code      text,
  legal_name    text,
  logo_url      text,
  cover_url     text,
  intro         text,
  description   text,
  website       text,
  email         text,
  phone         text,
  address       text,
  province_code text,
  founded_year  int,
  size_range    text,
  status        text not null default 'draft'
                check (status in ('draft','published','suspended')),
  verified_tier text not null default 'none'
                check (verified_tier in ('none','legal','capability','gold')),
  trust_score   numeric(5,2) default 0,
  profile_completeness int default 0,
  owner_id      uuid references public.profiles(id),
  search_tsv    tsvector,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);
create index companies_status_idx    on public.companies (status) where deleted_at is null;
create index companies_verified_idx  on public.companies (verified_tier);
create index companies_trust_idx     on public.companies (trust_score desc);
create index companies_search_idx    on public.companies using gin (search_tsv);
create index companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);

create table public.company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member'
              check (role in ('owner','admin','editor','member')),
  status      text not null default 'active'
              check (status in ('active','invited','removed')),
  created_at  timestamptz default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx    on public.company_members (user_id);
create index company_members_company_idx on public.company_members (company_id);

create table public.company_invitations (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  email       text not null,
  role        text not null default 'member',
  token       text not null unique,
  invited_by  uuid references public.profiles(id),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz default now()
);

create table public.company_verifications (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         text not null check (kind in ('tax','business_license','capability_cert')),
  status       text not null default 'pending'
               check (status in ('pending','verified','rejected')),
  reference    text,
  cert_class   text,
  evidence_url text,
  meta         jsonb default '{}',
  verified_by  uuid references public.profiles(id),
  verified_at  timestamptz,
  created_at   timestamptz default now()
);
create index company_verifications_idx on public.company_verifications (company_id, kind);

-- ---------- Danh mục & địa lý ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories(id),
  group_key  text not null check (group_key in ('contractor','crew','supplier','service')),
  slug       text unique not null,
  name       text not null,
  sort_order int default 0
);

create table public.company_categories (
  company_id  uuid references public.companies(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  primary key (company_id, category_id)
);

create table public.provinces (
  code text primary key,
  name text not null
);

create table public.company_locations (
  company_id    uuid references public.companies(id) on delete cascade,
  province_code text references public.provinces(code),
  primary key (company_id, province_code)
);

-- ---------- Portfolio ----------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  title         text not null,
  role          text,
  category_id   uuid references public.categories(id),
  province_code text,
  scale         text,
  year          int,
  cover_url     text,
  description   text,
  status        text default 'completed' check (status in ('ongoing','completed')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index projects_company_idx on public.projects (company_id);

create table public.media (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  owner_type  text not null check (owner_type in ('company','project','post')),
  owner_id    uuid not null,
  kind        text not null check (kind in ('image','video')),
  url         text not null,
  caption     text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index media_owner_idx on public.media (owner_type, owner_id);

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title       text not null,
  file_url    text not null,
  visibility  text not null default 'members'
              check (visibility in ('public','members','connections')),
  size_bytes  bigint,
  created_at  timestamptz default now()
);
create index documents_company_idx on public.documents (company_id);

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  category_id uuid references public.categories(id),
  description text,
  price_from  numeric,
  price_to    numeric,
  price_unit  text,
  created_at  timestamptz default now()
);

create table public.equipment (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name       text not null,
  quantity   int,
  note       text
);

create table public.staff (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  full_name        text,
  title            text,
  experience_years int,
  avatar_url       text
);

-- ---------- News Feed ----------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  author_id     uuid references public.profiles(id),
  type          text not null default 'news'
                check (type in ('news','new_project','completed_project',
                                'recruitment','equipment','certificate','promotion','activity')),
  title         text,
  body          text,
  status        text not null default 'published'
                check (status in ('draft','published','hidden')),
  like_count    int default 0,
  comment_count int default 0,
  search_tsv    tsvector,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);
create index posts_company_idx on public.posts (company_id, created_at desc);
create index posts_search_idx  on public.posts using gin (search_tsv);

create table public.post_reactions (
  post_id    uuid references public.posts(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

-- ---------- Marketplace ----------
create table public.marketplace_listings (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  author_id     uuid references public.profiles(id),
  type          text not null
                check (type in ('need_contractor','need_crew','need_supplier',
                                'partnership','offer_service','opportunity')),
  title         text not null,
  description   text,
  category_id   uuid references public.categories(id),
  province_code text,
  budget_from   numeric,
  budget_to     numeric,
  deadline      date,
  status        text not null default 'open'
                check (status in ('open','closed','fulfilled','expired')),
  is_featured   boolean default false,
  quote_count   int default 0,
  search_tsv    tsvector,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz
);
create index listings_type_idx   on public.marketplace_listings (type, status, created_at desc);
create index listings_search_idx on public.marketplace_listings using gin (search_tsv);

create table public.quotes (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references public.marketplace_listings(id) on delete cascade,
  company_id     uuid not null references public.companies(id) on delete cascade,
  amount         numeric,
  currency       text default 'VND',
  message        text,
  attachment_url text,
  status         text not null default 'sent'
                 check (status in ('sent','shortlisted','accepted','rejected','withdrawn')),
  created_at     timestamptz default now(),
  unique (listing_id, company_id)
);
create index quotes_listing_idx on public.quotes (listing_id);

-- ---------- Chat ----------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  context_type    text check (context_type in ('listing','project','company')),
  context_id      uuid,
  created_by      uuid references public.profiles(id),
  last_message_at timestamptz,
  created_at      timestamptz default now()
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete cascade,
  primary key (conversation_id, company_id)
);

create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  sender_company_id uuid references public.companies(id),
  sender_user_id    uuid references public.profiles(id),
  body              text,
  kind              text default 'text' check (kind in ('text','quote','file','system')),
  attachment_url    text,
  meta              jsonb default '{}',
  read_by           uuid[] default '{}',
  created_at        timestamptz default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

-- ---------- Kết nối, đánh giá, Trust Score ----------
create table public.connections (
  id                   uuid primary key default gen_random_uuid(),
  requester_company_id uuid not null references public.companies(id) on delete cascade,
  target_company_id    uuid not null references public.companies(id) on delete cascade,
  listing_id           uuid references public.marketplace_listings(id),
  status               text not null default 'pending'
                       check (status in ('pending','accepted','completed','cancelled')),
  created_at           timestamptz default now(),
  completed_at         timestamptz
);
create index connections_req_idx on public.connections (requester_company_id);
create index connections_tgt_idx on public.connections (target_company_id);

create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  connection_id       uuid not null references public.connections(id),
  reviewer_company_id uuid not null references public.companies(id),
  target_company_id   uuid not null references public.companies(id) on delete cascade,
  score_quality       int check (score_quality between 1 and 5),
  score_progress      int check (score_progress between 1 and 5),
  score_cost          int check (score_cost between 1 and 5),
  score_cooperation   int check (score_cooperation between 1 and 5),
  score_safety        int check (score_safety between 1 and 5),
  score_warranty      int check (score_warranty between 1 and 5),
  overall             numeric(3,2),
  comment             text,
  status              text default 'published' check (status in ('published','hidden','flagged')),
  created_at          timestamptz default now(),
  unique (connection_id, reviewer_company_id)
);
create index reviews_target_idx on public.reviews (target_company_id, status);

create table public.trust_scores (
  company_id  uuid primary key references public.companies(id) on delete cascade,
  score       numeric(5,2) not null default 0,
  breakdown   jsonb not null default '{}',
  computed_at timestamptz default now()
);

create table public.trust_score_history (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  score      numeric(5,2),
  breakdown  jsonb,
  created_at timestamptz default now()
);

-- ---------- Thông báo, gói dịch vụ, quảng cáo ----------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id),
  type       text not null,
  title      text,
  body       text,
  link       text,
  data       jsonb default '{}',
  is_read    boolean default false,
  created_at timestamptz default now()
);
create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email   boolean default true,
  zalo    boolean default true,
  push    boolean default true,
  digest  text default 'instant' check (digest in ('instant','daily','off'))
);

create table public.plans (
  id          text primary key,
  name        text,
  price_month numeric,
  features    jsonb default '{}'
);

create table public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id    text references public.plans(id),
  status     text default 'active' check (status in ('active','past_due','cancelled')),
  started_at timestamptz default now(),
  expires_at timestamptz
);

create table public.ad_placements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  slot         text,
  creative_url text,
  target_url   text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  status       text default 'active'
);

-- ---------- Kiểm toán & kiểm duyệt ----------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  company_id  uuid,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  diff        jsonb,
  ip          inet,
  created_at  timestamptz default now()
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id),
  entity_type text,
  entity_id   uuid,
  reason      text,
  status      text default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at  timestamptz default now()
);
