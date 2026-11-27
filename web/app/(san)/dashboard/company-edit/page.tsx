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
  const [cats, provs, myCats, myLocs, projects, docs, services, staff, equipment, photos, gallery, partners, awards, milestones, branches, faqs] = await Promise.all([
    supa.from('categories').select('id, name, group_key').order('sort_order'),
    supa.from('provinces').select('code, name').order('name'),
    supa.from('company_categories').select('category_id').eq('company_id', id),
    supa.from('company_locations').select('province_code').eq('company_id', id),
    supa.from('projects').select('id, title, role, year, province_code, cover_url, kind, is_featured').eq('company_id', id).order('year', { ascending: false }),
    supa.from('documents').select('id, title, file_url, visibility, size_bytes').eq('company_id', id).order('created_at', { ascending: false }),
    supa.from('services').select('*').eq('company_id', id).order('created_at'),
    supa.from('staff').select('*').eq('company_id', id).order('sort_order'),
    supa.from('equipment').select('*').eq('company_id', id),
    supa.from('media').select('id, url, caption, owner_id').eq('company_id', id).eq('owner_type', 'project').order('sort_order'),
    supa.from('media').select('id, kind, url, caption, sort_order, hidden_at').eq('company_id', id).eq('owner_type', 'company').order('sort_order').order('created_at'),
    supa.from('company_partners').select('*').eq('company_id', id).order('sort_order').order('created_at'),
    supa.from('company_awards').select('*').eq('company_id', id).order('sort_order').order('created_at'),
    supa.from('company_milestones').select('*').eq('company_id', id).order('sort_order').order('created_at'),
    supa.from('company_branches').select('*').eq('company_id', id).order('sort_order').order('created_at'),
    supa.from('company_faqs').select('*').eq('company_id', id).order('sort_order').order('created_at'),
  ]);

  return (
    <CompanyEditForm
      company={company as any}
      canEdit={role === 'owner' || role === 'admin' || role === 'editor'}
      canAdmin={role === 'owner' || role === 'admin'}
      categories={(cats.data ?? []) as any}
      provinces={(provs.data ?? []) as any}
      initialCategoryIds={(myCats.data ?? []).map((r: any) => r.category_id)}
      initialProvinceCodes={(myLocs.data ?? []).map((r: any) => r.province_code)}
      initialProjects={(projects.data ?? []) as any}
      initialDocs={(docs.data ?? []) as any}
      services={(services.data ?? []) as any}
      staff={(staff.data ?? []) as any}
      equipment={(equipment.data ?? []) as any}
      projectPhotos={(photos.data ?? []) as any}
      gallery={(gallery.data ?? []) as any}
      partners={(partners.data ?? []) as any}
      awards={(awards.data ?? []) as any}
      milestones={(milestones.data ?? []) as any}
      branches={(branches.data ?? []) as any}
      faqs={(faqs.data ?? []) as any}
    />
  );
}
