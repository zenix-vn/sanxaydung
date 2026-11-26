// Kiểu dữ liệu API (khớp schema Supabase). Dùng chung web + mobile.

export type VerifiedTier = 'none' | 'legal' | 'capability' | 'gold';

export interface Company {
  id: string;
  slug: string;
  name: string;
  tax_code: string | null;
  legal_name: string | null;
  logo_url: string | null;
  cover_url: string | null;
  intro: string | null;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  province_code: string | null;
  founded_year: number | null;
  size_range: string | null;
  status: string;
  verified_tier: VerifiedTier;
  trust_score: number;
  profile_completeness: number;
  owner_id: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  parent_id: string | null;
  group_key: 'contractor' | 'crew' | 'supplier' | 'service';
  slug: string;
  name: string;
  sort_order: number;
}

export interface Province {
  code: string;
  name: string;
}

export interface Project {
  id: string;
  company_id: string;
  title: string;
  role: string | null;
  province_code: string | null;
  year: number | null;
  cover_url: string | null;
  description: string | null;
  status: string;
}

export interface Listing {
  id: string;
  company_id: string;
  type: string;
  title: string;
  description: string | null;
  category_id: string | null;
  province_code: string | null;
  location_text: string | null;
  budget_from: number | null;
  budget_to: number | null;
  deadline: string | null;
  status: string;
  is_featured: boolean;
  quote_count: number;
  company_name: string | null;
  start_date: string | null;
  view_count: number | null;
  created_at: string;
}

export interface Service {
  id: string;
  company_id: string;
  name: string;
  category_id: string | null;
  description: string | null;
  price_from: number | null;
  price_to: number | null;
  price_unit: string | null;
}

export interface Staff {
  id: string;
  company_id: string;
  full_name: string | null;
  title: string | null;
  experience_years: number | null;
  avatar_url: string | null;
}

export interface Equipment {
  id: string;
  company_id: string;
  name: string;
  quantity: number | null;
  note: string | null;
}

export interface Review {
  id: string;
  connection_id: string;
  reviewer_company_id: string;
  target_company_id: string;
  score_quality: number | null;
  score_progress: number | null;
  score_cost: number | null;
  score_cooperation: number | null;
  score_safety: number | null;
  score_warranty: number | null;
  overall: number | null;
  comment: string | null;
  status: string;
  created_at: string;
  reply?: string | null;
  reviewer_company?: { id: string; name: string; slug: string; logo_url: string | null } | null;
}

export interface CompanyDetail extends Company {
  company_categories?: { categories: Category | null }[];
  company_locations?: { provinces: Province | null }[];
  projects?: Project[];
  trust_scores?: { score: number; breakdown: Record<string, number> } | null;
  company_verifications?: { id: string; kind: string; cert_class: string | null; status: string; verified_at: string | null }[];
  services?: Service[];
  staff?: Staff[];
  equipment?: Equipment[];
  reviews?: Review[];
}

// ---------------------------------------------------------------
// Bảng & RPC bổ sung (AI-1). Viết tay theo supabase/migrations — khi có DB local
// chạy `supabase gen types typescript --local` để đối chiếu/sinh lại.
// ---------------------------------------------------------------

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
}

export type PostType =
  | 'news' | 'new_project' | 'completed_project' | 'recruitment'
  | 'equipment' | 'certificate' | 'promotion' | 'activity';

export interface Post {
  id: string;
  company_id: string;
  author_id: string | null;
  type: PostType;
  title: string | null;
  body: string | null;
  status: 'draft' | 'published' | 'hidden';
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  listing_id: string;
  company_id: string;
  amount: number | null;
  currency: string;
  message: string | null;
  attachment_url: string | null;
  status: 'sent' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface Connection {
  id: string;
  requester_company_id: string;
  target_company_id: string;
  listing_id: string | null;
  status: ConnectionStatus;
  created_at: string;
  completed_at: string | null;
}

export type VerificationKind = 'tax' | 'business_license' | 'capability_cert';

export interface CompanyVerification {
  id: string;
  company_id: string;
  kind: VerificationKind;
  status: 'pending' | 'verified' | 'rejected';
  reference: string | null;
  cert_class: string | null;
  evidence_url: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface CompanyClaim {
  id: string;
  company_id: string;
  user_id: string;
  method: 'phone' | 'email' | 'manual';
  claimed_phone: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_company_id: string | null;
  sender_user_id: string | null;
  body: string | null;
  kind: 'text' | 'quote' | 'file' | 'system';
  attachment_url: string | null;
  meta: Record<string, unknown>;
  read_by: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  company_id: string | null;
  type: string;
  title: string | null;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// Kết quả rpc('list_conversations', { _as_company })
export interface ConversationSummary {
  conversation_id: string;
  other_company_id: string | null;
  other_company_name: string | null;
  other_company_slug: string | null;
  other_logo_url: string | null;
  context_type: 'listing' | 'project' | 'company' | null;
  context_id: string | null;
  last_message_at: string | null;
  last_message_body: string | null;
  unread_count: number;
}

// Chữ ký các RPC (tham số khớp tên trong SQL, dùng với supabase.rpc)
export interface RpcFunctions {
  create_connection:    { args: { _target: string; _as_company: string; _listing?: string | null }; returns: string };
  respond_connection:   { args: { _connection: string; _as_company: string; _accept: boolean }; returns: void };
  complete_connection:  { args: { _connection: string; _as_company: string }; returns: void };
  submit_review: {
    args: {
      _connection: string; _reviewer: string; _target: string;
      _quality: number; _progress: number; _cost: number;
      _cooperation: number; _safety: number; _warranty: number;
      _comment?: string | null;
    };
    returns: string;
  };
  request_verification: { args: { _company: string; _kind: VerificationKind; _reference?: string | null; _evidence_url?: string | null; _cert_class?: string | null; _meta?: Record<string, unknown> }; returns: string };
  set_quote_status:     { args: { _quote: string; _status: 'shortlisted' | 'accepted' | 'rejected' }; returns: void };
  toggle_like:          { args: { _post: string }; returns: boolean };
  start_conversation:   { args: { _as_company: string; _target: string; _context_type?: 'listing' | 'project' | 'company'; _context_id?: string | null }; returns: string };
  list_conversations:   { args: { _as_company: string }; returns: ConversationSummary[] };
  mark_read:            { args: { _conversation: string; _as_company: string }; returns: void };
  my_claimable_companies: { args: Record<string, never>; returns: { id: string; name: string; slug: string; address: string | null; verified_tier: string }[] };
  claim_company:        { args: { _company: string; _note?: string | null }; returns: 'claimed' | 'pending' };
  export_my_data:       { args: Record<string, never>; returns: Record<string, unknown> };
  delete_my_account:    { args: Record<string, never>; returns: void };
}

// Bao đóng phản hồi API thống nhất
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: { limit?: number; offset?: number; count?: number };
}
