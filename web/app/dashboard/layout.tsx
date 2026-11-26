import { requireUserCompany } from '@/lib/supabase/company';
import DashNav from './DashNav';

export const dynamic = 'force-dynamic';

async function countBadges(supa: Awaited<ReturnType<typeof requireUserCompany>>['supa'], userId: string, companyId: string) {
  const head = { count: 'exact' as const, head: true };
  const [q, c, m, n] = await Promise.all([
    supa.from('quotes').select('id, listing:marketplace_listings!inner(company_id)', head).eq('listing.company_id', companyId).eq('status', 'sent'),
    supa.from('connections').select('id', head).eq('target_company_id', companyId).eq('status', 'pending'),
    supa.from('notifications').select('id', head).eq('user_id', userId).eq('is_read', false).eq('type', 'new_message'),
    supa.from('notifications').select('id', head).eq('user_id', userId).eq('is_read', false),
  ]);
  return { quotes: q.count ?? 0, connections: c.count ?? 0, messages: m.count ?? 0, notifications: n.count ?? 0 };
}

/** Khung chung cho /dashboard/*: sidebar + bộ chọn doanh nghiệp. Chưa có công ty → chỉ hiển thị nội dung (onboarding). */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supa, user, company, role, companies } = await requireUserCompany('/dashboard');
  if (!company) return <>{children}</>;

  const badges = await countBadges(supa, user.id, company.id as string).catch(() => ({ quotes: 0, connections: 0, messages: 0, notifications: 0 }));
  const active = { id: company.id as string, name: company.name as string, slug: company.slug as string, logo_url: (company.logo_url as string) ?? null, role: role ?? 'member' };

  return (
    <div className="dash">
      <DashNav active={active} tier={(company.verified_tier as string) ?? 'none'} companies={companies} badges={badges} />
      <main className="dmain">{children}</main>
    </div>
  );
}
