import type { Metadata } from 'next';
import { requireUserCompany } from '@/lib/supabase/company';
import NewCompanyForm from './NewCompanyForm';

export const metadata: Metadata = { title: 'Tạo doanh nghiệp mới' };
export const dynamic = 'force-dynamic';

export default async function NewCompanyPage() {
  const { user } = await requireUserCompany('/dashboard/new');
  const phone = user.phone ? `0${user.phone.replace(/^\+?84/, '')}` : '';
  return <NewCompanyForm userId={user.id} defaultPhone={phone} />;
}
