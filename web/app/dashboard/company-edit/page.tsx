import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import CompanyEditForm from './CompanyEditForm';

export const metadata: Metadata = { title: 'Chỉnh sửa hồ sơ' };
export const dynamic = 'force-dynamic';

export default async function CompanyEditPage() {
  const { supa, company, role } = await requireUserCompany('/dashboard/company-edit');
  if (!company) redirect('/dashboard');

  const id = company.id as string;
  const [cats, provs, myCats, myLocs, projects, docs] = await Promise.all([
    supa.from('categories').select('id, name, group_key').order('sort_order'),
    supa.from('provinces').select('code, name').order('name'),
    supa.from('company_categories').select('category_id').eq('company_id', id),
    supa.from('company_locations').select('province_code').eq('company_id', id),
    supa.from('projects').select('id, title, role, year, province_code').eq('company_id', id).order('year', { ascending: false }),
    supa.from('documents').select('id, title, file_url, visibility, size_bytes').eq('company_id', id).order('created_at', { ascending: false }),
  ]);

  return (
    <CompanyEditForm
      company={company as any}
      canEdit={role === 'owner' || role === 'admin' || role === 'editor'}
      categories={(cats.data ?? []) as any}
      provinces={(provs.data ?? []) as any}
      initialCategoryIds={(myCats.data ?? []).map((r: any) => r.category_id)}
      initialProvinceCodes={(myLocs.data ?? []).map((r: any) => r.province_code)}
      initialProjects={(projects.data ?? []) as any}
      initialDocs={(docs.data ?? []) as any}
    />
  );
}
