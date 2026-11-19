import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import NewCompanyForm from './NewCompanyForm';

export const metadata: Metadata = { title: 'Tạo doanh nghiệp mới' };
export const dynamic = 'force-dynamic';

export default async function NewCompanyPage() {
  const { user, company } = await requireUserCompany('/dashboard/new');
  if (company) redirect('/dashboard');
  const phone = user.phone ? `0${user.phone.replace(/^\+?84/, '')}` : '';
  return <NewCompanyForm userId={user.id} defaultPhone={phone} />;
}
