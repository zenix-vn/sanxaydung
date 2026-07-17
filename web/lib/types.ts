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
  budget_from: number | null;
  budget_to: number | null;
  deadline: string | null;
  status: string;
  is_featured: boolean;
  quote_count: number;
  created_at: string;
}

export interface CompanyDetail extends Company {
  company_categories?: { categories: Category | null }[];
  company_locations?: { provinces: Province | null }[];
  projects?: Project[];
  trust_scores?: { score: number; breakdown: Record<string, number> } | null;
}

// Bao đóng phản hồi API thống nhất
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: { limit?: number; offset?: number; count?: number };
}
