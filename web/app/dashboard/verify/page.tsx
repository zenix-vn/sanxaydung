import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUserCompany } from '@/lib/supabase/company';
import VerifyClient from './VerifyClient';

export const metadata: Metadata = { title: 'Xác minh doanh nghiệp' };
export const dynamic = 'force-dynamic';

export default async function VerifyPage() {
  const { supa, company, role } = await requireUserCompany('/dashboard/verify');
  if (!company) redirect('/dashboard');

  const { data: verifications } = await supa
    .from('company_verifications')
    .select('id, kind, status, reference, cert_class, created_at, verified_at')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false });

  const { data: ts } = await supa.from('trust_scores').select('score').eq('company_id', company.id).maybeSingle();

  return (
    <VerifyClient
      company={{ id: company.id, name: company.name, tax_code: company.tax_code ?? null, tier: company.verified_tier ?? 'none' }}
      trust={Math.round(Number(ts?.score ?? company.trust_score ?? 0))}
      canRequest={role === 'owner' || role === 'admin'}
      verifications={(verifications ?? []) as any}
    />
  );
}
